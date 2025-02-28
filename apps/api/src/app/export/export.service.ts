import { environment } from '@ghostfolio/api/environments/environment';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { Export } from '@ghostfolio/common/interfaces';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ExportService {
  public constructor(private readonly prismaService: PrismaService) {}

  public async export({
    activityIds,
    userId
  }: {
    activityIds?: string[];
    userId: string;
  }): Promise<Export> {
    const accounts = await this.prismaService.account.findMany({
      orderBy: {
        name: 'asc'
      },
      select: {
        accountType: true,
        balance: true,
        currency: true,
        id: true,
        isExcluded: true,
        name: true,
        platformId: true
      },
      where: { userId }
    });

    let activities = await this.prismaService.order.findMany({
      orderBy: { date: 'desc' },
      select: {
        accountId: true,
        comment: true,
        date: true,
        fee: true,
        id: true,
        quantity: true,
        SymbolProfile: true,
        type: true,
        unitPrice: true
      },
      where: { userId }
    });

    if (activityIds) {
      activities = activities.filter((activity) => {
        return activityIds.includes(activity.id);
      });
    }

    return {
      meta: { date: new Date().toISOString(), version: environment.version },
      accounts,
      activities: activities.map(
        ({
          accountId,
          comment,
          date,
          fee,
          id,
          quantity,
          SymbolProfile,
          type,
          unitPrice
        }) => {
          return {
            accountId,
            comment,
            fee,
            id,
            quantity,
            type,
            unitPrice,
            currency: SymbolProfile.currency,
            dataSource: SymbolProfile.dataSource,
            date: date.toISOString(),
            symbol: type === 'ITEM' ? SymbolProfile.name : SymbolProfile.symbol
          };
        }
      )
    };
  }
}
