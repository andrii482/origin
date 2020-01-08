import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionOptions } from 'typeorm';

import { JsonEntity } from './pods/json-entity/json-entity.entity';
import { MarketContractLookup } from './pods/contracts-storage/market-contract-lookup.entity';
import { Currency } from './pods/currency/currency.entity';
import { Compliance } from './pods/compliance/compliance.entity';
import { Organization } from './pods/organization/organization.entity';
import { User } from './pods/user/user.entity';
import { UserModule } from './pods/user/user.module';
import { ComplianceModule } from './pods/compliance/compliance.module';
import createConfig from './config/configuration';
import { Country } from './pods/country/country.entity';
import { CountryModule } from './pods/country/country.module';
import { CurrencyModule } from './pods/currency/currency.module';
import { ImageModule } from './pods/image/image.module';
import { JsonEntityModule } from './pods/json-entity/json-entity.module';
import { ContractsStorageModule } from './pods/contracts-storage/contracts-storage.module';
import { OrganizationModule } from './pods/organization/organization.module';

// @TODO implement
// program.option('-e, --env <env_file_path>', 'path to the .env file');
// program.parse(process.argv);

// dotenv.config({
//     path: program.env ? path.resolve(__dirname, program.env) : '../../.env'
// });

@Module({
    imports: [
        ConfigModule.forRoot({
            envFilePath: '../../.env',
            load: [createConfig],
            isGlobal: true
        }),
        TypeOrmModule.forRootAsync({
            useFactory: async (configService: ConfigService) => ({
                ...configService.get<ConnectionOptions>('ORM'),
                entities: [
                    JsonEntity,
                    MarketContractLookup,
                    Currency,
                    Compliance,
                    Country,
                    Organization,
                    User
                ]
            }),
            inject: [ConfigService]
        }),
        ImageModule,
        UserModule,
        ComplianceModule,
        CountryModule,
        CurrencyModule,
        JsonEntityModule,
        ContractsStorageModule,
        OrganizationModule
    ],
    controllers: [],
    providers: []
})
export class AppModule {}
