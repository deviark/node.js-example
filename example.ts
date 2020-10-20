import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException, forwardRef, Inject } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AccessTokenService } from '../../services/access-token.service';
import { CompanyRepository } from '../../repositories/company.repository';
import { CategoryRepository } from '../../repositories/category.repository';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { ICompany } from '../../repositories/interfaces';
import { Types } from 'mongoose';
import { CompanyImageRepository } from '../../repositories/company-image.repository';
import { EmailService } from '../../services/email.service';
import { ServiceService } from '../service/services/service.service';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly accessTokenService: AccessTokenService,
    private readonly companyImageRepository: CompanyImageRepository,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => ServiceService))
    private readonly serviceService: ServiceService,
  ) { }

  public async signUp(data: SignUpDto) {
    const companyData = await this.companyRepository.findOne({
      email: data.email,
    });

    if (companyData) {
      throw new BadRequestException('Company with this email already exist')
    }

    const conditions: any[] = [{ title: data.category }]
    Types.ObjectId.isValid(data.category) && conditions.push({ _id: data.category })
    const categoryMatch = await this.categoryRepository.findOne({
      $or: conditions
    })

    if (!categoryMatch) {
      throw new BadRequestException('Such category don\'t exist')
    }
    data.category = categoryMatch._id.toString()

    const company = await this.companyRepository.create(data);
    const accessToken = await this.accessTokenService.createAccessToken(
      true,
      company._id.toString(),
    );

    return {
      accessToken: accessToken._id,
      company: await this.companyInfo(company)
    };
  }

  public async signIn(data: SignInDto) {
    const company = await this.companyRepository.findOne({ email: data.email });

    if (!company) {
      throw new NotFoundException('Company not found')
    }

    const isMatched = await bcrypt.compareSync(data.password, company.passwordHash);

    if (!isMatched) {
      throw new UnprocessableEntityException('Invalid credentials')
    }

    const accessToken = await this.accessTokenService.createAccessToken(
      true,
      company._id.toString(),
    );

    return {
      accessToken: accessToken._id,
      company: await this.companyInfo(company)
    }
  }

  public async update(companyId: string, dataToUpdate: any): Promise<ICompany> {
    await this.companyRepository.updateOne({ _id: companyId }, dataToUpdate);
    const company = await this.companyRepository.findOne({ _id: companyId });
    return await this.companyInfo(company)
  }
}