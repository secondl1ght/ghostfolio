import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { DataService } from '@ghostfolio/client/services/data.service';
import { ImpersonationStorageService } from '@ghostfolio/client/services/impersonation-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { getDateFormatString, getEmojiFlag } from '@ghostfolio/common/helper';
import { AdminData, InfoItem, User } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import {
  differenceInSeconds,
  formatDistanceToNowStrict,
  parseISO
} from 'date-fns';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'gf-admin-users',
  styleUrls: ['./admin-users.scss'],
  templateUrl: './admin-users.html'
})
export class AdminUsersComponent implements OnDestroy, OnInit {
  public defaultDateFormat: string;
  public getEmojiFlag = getEmojiFlag;
  public hasPermissionForSubscription: boolean;
  public hasPermissionToImpersonateAllUsers: boolean;
  public info: InfoItem;
  public user: User;
  public users: AdminData['users'];

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private impersonationStorageService: ImpersonationStorageService,
    private userService: UserService
  ) {
    this.info = this.dataService.fetchInfo();

    this.hasPermissionForSubscription = hasPermission(
      this.info?.globalPermissions,
      permissions.enableSubscription
    );

    this.userService.stateChanged
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;

          this.defaultDateFormat = getDateFormatString(
            this.user.settings.locale
          );

          this.hasPermissionToImpersonateAllUsers = hasPermission(
            this.user.permissions,
            permissions.impersonateAllUsers
          );
        }
      });
  }

  public ngOnInit() {
    this.fetchAdminData();
  }

  public formatDistanceToNow(aDateString: string) {
    if (aDateString) {
      const distanceString = formatDistanceToNowStrict(parseISO(aDateString), {
        addSuffix: true
      });

      return Math.abs(differenceInSeconds(parseISO(aDateString), new Date())) <
        60
        ? 'just now'
        : distanceString;
    }

    return '';
  }

  public onDeleteUser(aId: string) {
    const confirmation = confirm(
      $localize`Do you really want to delete this user?`
    );

    if (confirmation) {
      this.dataService
        .deleteUser(aId)
        .pipe(takeUntil(this.unsubscribeSubject))
        .subscribe({
          next: () => {
            this.fetchAdminData();
          }
        });
    }
  }

  public onImpersonateUser(aId: string) {
    if (aId) {
      this.impersonationStorageService.setId(aId);
    } else {
      this.impersonationStorageService.removeId();
    }

    window.location.reload();
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }

  private fetchAdminData() {
    this.dataService
      .fetchAdminData()
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(({ users }) => {
        this.users = users;

        this.changeDetectorRef.markForCheck();
      });
  }
}
