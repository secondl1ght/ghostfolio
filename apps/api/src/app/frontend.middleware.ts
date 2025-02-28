import * as fs from 'fs';
import * as path from 'path';

import { environment } from '@ghostfolio/api/environments/environment';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { DEFAULT_LANGUAGE_CODE } from '@ghostfolio/common/config';
import { DATE_FORMAT } from '@ghostfolio/common/helper';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { format } from 'date-fns';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class FrontendMiddleware implements NestMiddleware {
  public indexHtmlDe = '';
  public indexHtmlEn = '';
  public indexHtmlEs = '';
  public indexHtmlFr = '';
  public indexHtmlIt = '';
  public indexHtmlNl = '';
  public indexHtmlPt = '';

  public constructor(
    private readonly configurationService: ConfigurationService
  ) {
    try {
      this.indexHtmlDe = fs.readFileSync(
        this.getPathOfIndexHtmlFile('de'),
        'utf8'
      );
      this.indexHtmlEn = fs.readFileSync(
        this.getPathOfIndexHtmlFile(DEFAULT_LANGUAGE_CODE),
        'utf8'
      );
      this.indexHtmlEs = fs.readFileSync(
        this.getPathOfIndexHtmlFile('es'),
        'utf8'
      );
      this.indexHtmlFr = fs.readFileSync(
        this.getPathOfIndexHtmlFile('fr'),
        'utf8'
      );
      this.indexHtmlIt = fs.readFileSync(
        this.getPathOfIndexHtmlFile('it'),
        'utf8'
      );
      this.indexHtmlNl = fs.readFileSync(
        this.getPathOfIndexHtmlFile('nl'),
        'utf8'
      );
      this.indexHtmlPt = fs.readFileSync(
        this.getPathOfIndexHtmlFile('pt'),
        'utf8'
      );
    } catch {}
  }

  public use(request: Request, response: Response, next: NextFunction) {
    const currentDate = format(new Date(), DATE_FORMAT);
    let featureGraphicPath = 'assets/cover.png';
    let title = 'Ghostfolio – Open Source Wealth Management Software';

    if (request.path.startsWith('/en/blog/2022/08/500-stars-on-github')) {
      featureGraphicPath = 'assets/images/blog/500-stars-on-github.jpg';
      title = `500 Stars - ${title}`;
    } else if (request.path.startsWith('/en/blog/2022/10/hacktoberfest-2022')) {
      featureGraphicPath = 'assets/images/blog/hacktoberfest-2022.png';
      title = `Hacktoberfest 2022 - ${title}`;
    } else if (request.path.startsWith('/en/blog/2022/11/black-friday-2022')) {
      featureGraphicPath = 'assets/images/blog/black-friday-2022.jpg';
      title = `Black Friday 2022 - ${title}`;
    } else if (
      request.path.startsWith(
        '/en/blog/2022/12/the-importance-of-tracking-your-personal-finances'
      )
    ) {
      featureGraphicPath = 'assets/images/blog/20221226.jpg';
      title = `The importance of tracking your personal finances - ${title}`;
    } else if (
      request.path.startsWith(
        '/de/blog/2023/01/ghostfolio-auf-sackgeld-vorgestellt'
      )
    ) {
      featureGraphicPath = 'assets/images/blog/ghostfolio-x-sackgeld.png';
      title = `Ghostfolio auf Sackgeld.com vorgestellt - ${title}`;
    } else if (
      request.path.startsWith('/en/blog/2023/02/ghostfolio-meets-umbrel')
    ) {
      featureGraphicPath = 'assets/images/blog/ghostfolio-x-umbrel.png';
      title = `Ghostfolio meets Umbrel - ${title}`;
    } else if (
      request.path.startsWith(
        '/en/blog/2023/03/ghostfolio-reaches-1000-stars-on-github'
      )
    ) {
      featureGraphicPath = 'assets/images/blog/1000-stars-on-github.jpg';
      title = `Ghostfolio reaches 1’000 Stars on GitHub - ${title}`;
    } else if (
      request.path.startsWith(
        '/en/blog/2023/05/unlock-your-financial-potential-with-ghostfolio'
      )
    ) {
      featureGraphicPath = 'assets/images/blog/20230520.jpg';
      title = `Unlock your Financial Potential with Ghostfolio - ${title}`;
    }

    if (
      request.path.startsWith('/api/') ||
      this.isFileRequest(request.url) ||
      !environment.production
    ) {
      // Skip
      next();
    } else if (request.path === '/de' || request.path.startsWith('/de/')) {
      response.send(
        this.interpolate(this.indexHtmlDe, {
          currentDate,
          featureGraphicPath,
          title,
          languageCode: 'de',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else if (request.path === '/es' || request.path.startsWith('/es/')) {
      response.send(
        this.interpolate(this.indexHtmlEs, {
          currentDate,
          featureGraphicPath,
          title,
          languageCode: 'es',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else if (request.path === '/fr' || request.path.startsWith('/fr/')) {
      response.send(
        this.interpolate(this.indexHtmlFr, {
          featureGraphicPath,
          languageCode: 'fr',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else if (request.path === '/it' || request.path.startsWith('/it/')) {
      response.send(
        this.interpolate(this.indexHtmlIt, {
          currentDate,
          featureGraphicPath,
          title,
          languageCode: 'it',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else if (request.path === '/nl' || request.path.startsWith('/nl/')) {
      response.send(
        this.interpolate(this.indexHtmlNl, {
          currentDate,
          featureGraphicPath,
          title,
          languageCode: 'nl',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else if (request.path === '/pt' || request.path.startsWith('/pt/')) {
      response.send(
        this.interpolate(this.indexHtmlPt, {
          featureGraphicPath,
          languageCode: 'pt',
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    } else {
      response.send(
        this.interpolate(this.indexHtmlEn, {
          currentDate,
          featureGraphicPath,
          title,
          languageCode: DEFAULT_LANGUAGE_CODE,
          path: request.path,
          rootUrl: this.configurationService.get('ROOT_URL')
        })
      );
    }
  }

  private getPathOfIndexHtmlFile(aLocale: string) {
    return path.join(__dirname, '..', 'client', aLocale, 'index.html');
  }

  private interpolate(template: string, context: any) {
    return template.replace(/[$]{([^}]+)}/g, (_, objectPath) => {
      const properties = objectPath.split('.');
      return properties.reduce(
        (previous, current) => previous?.[current],
        context
      );
    });
  }

  private isFileRequest(filename: string) {
    if (filename === '/assets/LICENSE') {
      return true;
    } else if (filename.includes('auth/ey')) {
      return false;
    }

    return filename.split('.').pop() !== filename;
  }
}
