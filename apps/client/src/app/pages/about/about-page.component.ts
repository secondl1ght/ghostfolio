import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { environment } from '@ghostfolio/client/../environments/environment';
import { DataService } from '@ghostfolio/client/services/data.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { DEFAULT_LANGUAGE_CODE } from '@ghostfolio/common/config';
import { Statistics, User } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  host: { class: 'page' },
  selector: 'gf-about-page',
  styleUrls: ['./about-page.scss'],
  templateUrl: './about-page.html'
})
export class AboutPageComponent implements OnDestroy, OnInit {
  public defaultLanguageCode = DEFAULT_LANGUAGE_CODE;
  public hasPermissionForBlog: boolean;
  public hasPermissionForStatistics: boolean;
  public hasPermissionForSubscription: boolean;
  public isLoggedIn: boolean;
  public statistics: Statistics;
  public user: User;
  public version = environment.version;

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private userService: UserService
  ) {
    const { globalPermissions, statistics } = this.dataService.fetchInfo();

    this.hasPermissionForBlog = hasPermission(
      globalPermissions,
      permissions.enableBlog
    );

    this.hasPermissionForStatistics = hasPermission(
      globalPermissions,
      permissions.enableStatistics
    );

    this.hasPermissionForSubscription = hasPermission(
      globalPermissions,
      permissions.enableSubscription
    );

    this.statistics = statistics;
  }

  public ngOnInit() {
    this.userService.stateChanged
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;

          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }
}
