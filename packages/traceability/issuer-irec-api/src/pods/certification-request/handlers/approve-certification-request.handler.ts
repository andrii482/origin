import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BigNumber } from 'ethers';
import { CertificationRequest as CertificationRequestFacade } from '@energyweb/issuer';
import { ISuccessResponse, ResponseFailure, ResponseSuccess } from '@energyweb/origin-backend-core';
import { HttpStatus, Logger } from '@nestjs/common';

import {
    CertificateRequestApprovedEvent,
    ApproveCertificationRequestCommand,
    BlockchainPropertiesService,
    CertificateCreatedEvent,
    CertificationRequestStatus
} from '@energyweb/issuer-api';

import { CertificationRequest } from '../certification-request.entity';

@CommandHandler(ApproveCertificationRequestCommand)
export class ApproveCertificationRequestHandler
    implements ICommandHandler<ApproveCertificationRequestCommand>
{
    private readonly logger = new Logger(ApproveCertificationRequestHandler.name);

    constructor(
        @InjectRepository(CertificationRequest)
        private readonly repository: Repository<CertificationRequest>,
        private readonly blockchainPropertiesService: BlockchainPropertiesService,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ApproveCertificationRequestCommand): Promise<ISuccessResponse> {
        const { id } = command;

        const { requestId, isPrivate, energy, approved, owner, status } =
            await this.repository.findOne(id);

        if (status !== CertificationRequestStatus.Executed) {
            const msg = `Certificate #${id} has not been yet deployed`;
            this.logger.debug(msg);
            return ResponseFailure(msg, HttpStatus.BAD_REQUEST);
        }

        if (approved) {
            const msg = `Certificate #${id} has already been approved`;
            this.logger.debug(msg);
            return ResponseFailure(msg, HttpStatus.BAD_REQUEST);
        }

        const blockchainProperties = await this.blockchainPropertiesService.get();

        const certReq = await new CertificationRequestFacade(
            requestId,
            blockchainProperties.wrap()
        ).sync();

        let newCertificateId;

        if (certReq.approved) {
            this.logger.warn(
                `Certification Request ${certReq.id} is unapproved but should be set to approved. Fixing...`
            );
            newCertificateId = certReq.issuedCertificateTokenId;
        } else {
            try {
                newCertificateId = await certReq.approve(BigNumber.from(isPrivate ? 0 : energy));
            } catch (e) {
                return ResponseFailure(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        await this.repository.update(id, {
            approved: true,
            approvedDate: certReq.approvedDate ?? new Date(),
            issuedCertificateTokenId: newCertificateId
        });

        this.eventBus.publish(
            new CertificateCreatedEvent(newCertificateId, isPrivate ? { owner, energy } : null)
        );

        this.eventBus.publish(new CertificateRequestApprovedEvent(id));

        return ResponseSuccess(`Successfully approved certificationRequest ${id}.`);
    }
}
