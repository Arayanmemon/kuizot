import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      role: 'owner',
    });
    await this.userRepository.save(user);

    // Auto-create free-tier subscription for new users
    const subscription = this.subscriptionRepository.create({
      user: { id: user.id },
      tier: 'free',
      billingModel: 'payg',
      creditBalance: 0,
      status: 'active',
    });
    await this.subscriptionRepository.save(subscription);

    const { accessToken, refreshToken } = this.issueTokens(user);

    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }

  /**
   * Used by LocalStrategy to validate credentials.
   * Returns the user (without sensitive fields) if valid, or null otherwise.
   */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  /**
   * Called by the controller after LocalStrategy has already authenticated the user.
   */
  async loginUser(user: User) {
    const { accessToken, refreshToken } = this.issueTokens(user);

    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.refreshToken = :token', { token: refreshToken })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } = this.issueTokens(user);

    user.refreshToken = newRefreshToken;
    await this.userRepository.save(user);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null });
  }

  private issueTokens(user: User) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role, email: user.email },
      {
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }
}
