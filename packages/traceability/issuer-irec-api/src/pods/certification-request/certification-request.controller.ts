import {
    ActiveUserGuard,
    ExceptionInterceptor,
    Roles,
    RolesGuard,
    UserDecorator
} from '@energyweb/origin-backend-utils';
import {
    Body,
    Controller,
    Get,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Put,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
    ILoggedInUser,
    ISuccessResponse,
    ResponseFailure,
    Role,
    ValidateDeviceOwnershipQuery
} from '@energyweb/origin-backend-core';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
    ApproveCertificationRequestCommand,
    CertificateBoundToCertificationRequestCommand,
    CreateCertificationRequestDTO,
    GetAllCertificationRequestsQuery,
    GetCertificationRequestByCertificateQuery,
    GetCertificationRequestQuery,
    RevokeCertificationRequestCommand,
    SuccessResponseDTO,
    ValidateCertificationRequestCommand
} from '@energyweb/issuer-api';
import { CreateIrecCertificationRequestCommand } from './commands';
import { CertificationRequestIrecDTO } from './certification-request.dto';

@ApiTags('certification-requests')
@ApiBearerAuth('access-token')
@Controller('certification-request')
@UseInterceptors(ExceptionInterceptor)
export class CertificationRequestController {
    constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

    @Get('/:id')
    @UseGuards(AuthGuard(), ActiveUserGuard)
    @ApiResponse({
        status: HttpStatus.OK,
        type: CertificationRequestIrecDTO,
        description: 'Returns a Certification Request'
    })
    public async get(
        @Param('id', new ParseIntPipe()) id: number
    ): Promise<CertificationRequestIrecDTO> {
        return this.queryBus.execute(new GetCertificationRequestQuery(id));
    }

    @Get()
    @UseGuards(AuthGuard(), ActiveUserGuard)
    @ApiResponse({
        status: HttpStatus.OK,
        type: [CertificationRequestIrecDTO],
        description: 'Returns all Certification Requests'
    })
    public async getAll(): Promise<CertificationRequestIrecDTO[]> {
        return this.queryBus.execute(new GetAllCertificationRequestsQuery());
    }

    @Get('/:certificateId')
    @UseGuards(AuthGuard(), ActiveUserGuard)
    @ApiResponse({
        status: HttpStatus.OK,
        type: CertificationRequestIrecDTO,
        description: 'Returns a Certification Request by a certificate ID'
    })
    public async getByCertificate(
        @Param('certificateId', new ParseIntPipe()) certificateId: number
    ): Promise<CertificationRequestIrecDTO | SuccessResponseDTO> {
        const validationCheck = await this.queryBus.execute<
            CertificateBoundToCertificationRequestCommand,
            ISuccessResponse
        >(new CertificateBoundToCertificationRequestCommand(certificateId));

        if (!validationCheck.success) {
            return validationCheck;
        }

        return this.queryBus.execute(new GetCertificationRequestByCertificateQuery(certificateId));
    }

    @Post()
    @UseGuards(AuthGuard(), ActiveUserGuard, RolesGuard)
    @Roles(Role.Issuer, Role.Admin, Role.OrganizationAdmin, Role.OrganizationDeviceManager)
    @ApiResponse({
        status: HttpStatus.OK,
        type: CertificationRequestIrecDTO,
        description: 'Creates a Certification Request'
    })
    @ApiBody({ type: CreateCertificationRequestDTO })
    public async create(
        @UserDecorator() user: ILoggedInUser,
        @Body() dto: CreateCertificationRequestDTO
    ): Promise<CertificationRequestIrecDTO | SuccessResponseDTO> {
        const isOwnerOfTheDevice = await this.queryBus.execute(
            new ValidateDeviceOwnershipQuery(user.ownerId, dto.deviceId)
        );

        if (!isOwnerOfTheDevice) {
            return ResponseFailure('Not a device owner', HttpStatus.FORBIDDEN);
        }

        const validationCheck = await this.commandBus.execute(
            new ValidateCertificationRequestCommand(dto)
        );

        if (!validationCheck.success) {
            return validationCheck;
        }

        return this.commandBus.execute(
            new CreateIrecCertificationRequestCommand(
                user,
                dto.to,
                dto.energy,
                dto.fromTime,
                dto.toTime,
                dto.deviceId,
                dto.files,
                dto.isPrivate
            )
        );
    }

    @Put('/:id/approve')
    @UseGuards(AuthGuard(), ActiveUserGuard, RolesGuard)
    @Roles(Role.Issuer, Role.Admin)
    @ApiResponse({
        status: HttpStatus.OK,
        type: SuccessResponseDTO,
        description: 'Approves a Certification Request'
    })
    public async approve(@Param('id', new ParseIntPipe()) id: number): Promise<SuccessResponseDTO> {
        return this.commandBus.execute(new ApproveCertificationRequestCommand(id));
    }

    @Put('/:id/revoke')
    @UseGuards(AuthGuard(), ActiveUserGuard, RolesGuard)
    @Roles(Role.Issuer, Role.Admin)
    @ApiResponse({
        status: HttpStatus.OK,
        type: SuccessResponseDTO,
        description: 'Revokes a Certification Request'
    })
    public async revoke(@Param('id', new ParseIntPipe()) id: number): Promise<SuccessResponseDTO> {
        return this.commandBus.execute(new RevokeCertificationRequestCommand(id));
    }
}
