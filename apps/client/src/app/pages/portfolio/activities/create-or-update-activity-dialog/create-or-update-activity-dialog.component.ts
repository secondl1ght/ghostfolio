import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CreateOrderDto } from '@ghostfolio/api/app/order/create-order.dto';
import { UpdateOrderDto } from '@ghostfolio/api/app/order/update-order.dto';
import { LookupItem } from '@ghostfolio/api/app/symbol/interfaces/lookup-item.interface';
import { DataService } from '@ghostfolio/client/services/data.service';
import { getDateFormatString } from '@ghostfolio/common/helper';
import { translate } from '@ghostfolio/ui/i18n';
import { AssetClass, AssetSubClass, Tag, Type } from '@prisma/client';
import { isUUID } from 'class-validator';
import { isString } from 'lodash';
import { EMPTY, Observable, Subject, lastValueFrom, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  takeUntil
} from 'rxjs/operators';

import { CreateOrUpdateActivityDialogParams } from './interfaces/interfaces';

@Component({
  host: { class: 'h-100' },
  selector: 'gf-create-or-update-activity-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./create-or-update-activity-dialog.scss'],
  templateUrl: 'create-or-update-activity-dialog.html'
})
export class CreateOrUpdateActivityDialog implements OnDestroy {
  @ViewChild('symbolAutocomplete') symbolAutocomplete;
  @ViewChild('tagInput') tagInput: ElementRef<HTMLInputElement>;

  public activityForm: FormGroup;
  public assetClasses = Object.keys(AssetClass).map((assetClass) => {
    return { id: assetClass, label: translate(assetClass) };
  });
  public assetSubClasses = Object.keys(AssetSubClass).map((assetSubClass) => {
    return { id: assetSubClass, label: translate(assetSubClass) };
  });
  public currencies: string[] = [];
  public currentMarketPrice = null;
  public defaultDateFormat: string;
  public filteredLookupItems: LookupItem[] = [];
  public filteredLookupItemsObservable: Observable<LookupItem[]> = of([]);
  public filteredTagsObservable: Observable<Tag[]> = of([]);
  public isLoading = false;
  public platforms: { id: string; name: string }[];
  public separatorKeysCodes: number[] = [ENTER, COMMA];
  public tags: Tag[] = [];
  public total = 0;
  public Validators = Validators;

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    @Inject(MAT_DIALOG_DATA) public data: CreateOrUpdateActivityDialogParams,
    private dataService: DataService,
    private dateAdapter: DateAdapter<any>,
    public dialogRef: MatDialogRef<CreateOrUpdateActivityDialog>,
    private formBuilder: FormBuilder,
    @Inject(MAT_DATE_LOCALE) private locale: string
  ) {}

  public ngOnInit() {
    this.locale = this.data.user?.settings?.locale;
    this.dateAdapter.setLocale(this.locale);

    const { currencies, platforms, tags } = this.dataService.fetchInfo();

    this.currencies = currencies;
    this.defaultDateFormat = getDateFormatString(this.locale);
    this.platforms = platforms;
    this.tags = tags.map(({ id, name }) => {
      return {
        id,
        name: translate(name)
      };
    });

    this.activityForm = this.formBuilder.group({
      accountId: [this.data.activity?.accountId, Validators.required],
      assetClass: [this.data.activity?.SymbolProfile?.assetClass],
      assetSubClass: [this.data.activity?.SymbolProfile?.assetSubClass],
      comment: [this.data.activity?.comment],
      currency: [
        this.data.activity?.SymbolProfile?.currency,
        Validators.required
      ],
      currencyOfFee: [
        this.data.activity?.SymbolProfile?.currency,
        Validators.required
      ],
      currencyOfUnitPrice: [
        this.data.activity?.SymbolProfile?.currency,
        Validators.required
      ],
      dataSource: [
        this.data.activity?.SymbolProfile?.dataSource,
        Validators.required
      ],
      date: [this.data.activity?.date, Validators.required],
      fee: [this.data.activity?.fee, Validators.required],
      feeInCustomCurrency: [this.data.activity?.fee, Validators.required],
      name: [this.data.activity?.SymbolProfile?.name, Validators.required],
      quantity: [this.data.activity?.quantity, Validators.required],
      searchSymbol: [
        {
          dataSource: this.data.activity?.SymbolProfile?.dataSource,
          symbol: this.data.activity?.SymbolProfile?.symbol
        },
        Validators.required
      ],
      tags: [
        this.data.activity?.tags?.map(({ id, name }) => {
          return {
            id,
            name: translate(name)
          };
        })
      ],
      type: [undefined, Validators.required], // Set after value changes subscription
      unitPrice: [this.data.activity?.unitPrice, Validators.required],
      unitPriceInCustomCurrency: [
        this.data.activity?.unitPrice,
        Validators.required
      ],
      updateAccountBalance: [false]
    });

    this.activityForm.valueChanges
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(async () => {
        let exchangeRateOfFee = 1;
        let exchangeRateOfUnitPrice = 1;

        this.activityForm.controls['feeInCustomCurrency'].setErrors(null);
        this.activityForm.controls['unitPriceInCustomCurrency'].setErrors(null);

        const currency = this.activityForm.controls['currency'].value;
        const currencyOfFee = this.activityForm.controls['currencyOfFee'].value;
        const currencyOfUnitPrice =
          this.activityForm.controls['currencyOfUnitPrice'].value;
        const date = this.activityForm.controls['date'].value;

        if (currency && currencyOfFee && currency !== currencyOfFee && date) {
          try {
            const { marketPrice } = await lastValueFrom(
              this.dataService
                .fetchExchangeRateForDate({
                  date,
                  symbol: `${currencyOfFee}-${currency}`
                })
                .pipe(takeUntil(this.unsubscribeSubject))
            );

            exchangeRateOfFee = marketPrice;
          } catch {
            this.activityForm.controls['feeInCustomCurrency'].setErrors({
              invalid: true
            });
          }
        }

        const feeInCustomCurrency =
          this.activityForm.controls['feeInCustomCurrency'].value *
          exchangeRateOfFee;

        this.activityForm.controls['fee'].setValue(feeInCustomCurrency, {
          emitEvent: false
        });

        if (
          currency &&
          currencyOfUnitPrice &&
          currency !== currencyOfUnitPrice &&
          date
        ) {
          try {
            const { marketPrice } = await lastValueFrom(
              this.dataService
                .fetchExchangeRateForDate({
                  date,
                  symbol: `${currencyOfUnitPrice}-${currency}`
                })
                .pipe(takeUntil(this.unsubscribeSubject))
            );

            exchangeRateOfUnitPrice = marketPrice;
          } catch {
            this.activityForm.controls['unitPriceInCustomCurrency'].setErrors({
              invalid: true
            });
          }
        }

        const unitPriceInCustomCurrency =
          this.activityForm.controls['unitPriceInCustomCurrency'].value *
          exchangeRateOfUnitPrice;

        this.activityForm.controls['unitPrice'].setValue(
          unitPriceInCustomCurrency,
          {
            emitEvent: false
          }
        );

        if (
          this.activityForm.controls['type'].value === 'BUY' ||
          this.activityForm.controls['type'].value === 'ITEM'
        ) {
          this.total =
            this.activityForm.controls['quantity'].value *
              this.activityForm.controls['unitPrice'].value +
              this.activityForm.controls['fee'].value ?? 0;
        } else {
          this.total =
            this.activityForm.controls['quantity'].value *
              this.activityForm.controls['unitPrice'].value -
              this.activityForm.controls['fee'].value ?? 0;
        }

        this.changeDetectorRef.markForCheck();
      });

    this.filteredLookupItemsObservable = this.activityForm.controls[
      'searchSymbol'
    ].valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((query: string) => {
        if (isString(query) && query.length > 1) {
          const filteredLookupItemsObservable =
            this.dataService.fetchSymbols(query);

          filteredLookupItemsObservable
            .pipe(takeUntil(this.unsubscribeSubject))
            .subscribe((filteredLookupItems) => {
              this.filteredLookupItems = filteredLookupItems;
            });

          return filteredLookupItemsObservable;
        }

        return [];
      })
    );

    this.filteredTagsObservable = this.activityForm.controls[
      'tags'
    ].valueChanges.pipe(
      startWith(this.activityForm.controls['tags'].value),
      map((aTags: Tag[] | null) => {
        return aTags ? this.filterTags(aTags) : this.tags.slice();
      })
    );

    this.activityForm.controls['type'].valueChanges
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((type: Type) => {
        if (type === 'ITEM') {
          this.activityForm.controls['accountId'].removeValidators(
            Validators.required
          );
          this.activityForm.controls['accountId'].updateValueAndValidity();
          this.activityForm.controls['currency'].setValue(
            this.data.user.settings.baseCurrency
          );
          this.activityForm.controls['currencyOfFee'].setValue(
            this.data.user.settings.baseCurrency
          );
          this.activityForm.controls['currencyOfUnitPrice'].setValue(
            this.data.user.settings.baseCurrency
          );
          this.activityForm.controls['dataSource'].removeValidators(
            Validators.required
          );
          this.activityForm.controls['dataSource'].updateValueAndValidity();
          this.activityForm.controls['name'].setValidators(Validators.required);
          this.activityForm.controls['name'].updateValueAndValidity();
          this.activityForm.controls['quantity'].setValue(1);
          this.activityForm.controls['searchSymbol'].removeValidators(
            Validators.required
          );
          this.activityForm.controls['searchSymbol'].updateValueAndValidity();
          this.activityForm.controls['updateAccountBalance'].disable();
          this.activityForm.controls['updateAccountBalance'].setValue(false);
        } else {
          this.activityForm.controls['accountId'].setValidators(
            Validators.required
          );
          this.activityForm.controls['accountId'].updateValueAndValidity();
          this.activityForm.controls['dataSource'].setValidators(
            Validators.required
          );
          this.activityForm.controls['dataSource'].updateValueAndValidity();
          this.activityForm.controls['name'].removeValidators(
            Validators.required
          );
          this.activityForm.controls['name'].updateValueAndValidity();
          this.activityForm.controls['searchSymbol'].setValidators(
            Validators.required
          );
          this.activityForm.controls['searchSymbol'].updateValueAndValidity();
          this.activityForm.controls['updateAccountBalance'].enable();
        }

        this.changeDetectorRef.markForCheck();
      });

    this.activityForm.controls['type'].setValue(this.data.activity?.type);

    if (this.data.activity?.id) {
      this.activityForm.controls['searchSymbol'].disable();
      this.activityForm.controls['type'].disable();
    }

    if (this.data.activity?.SymbolProfile?.symbol) {
      this.dataService
        .fetchSymbolItem({
          dataSource: this.data.activity?.SymbolProfile?.dataSource,
          symbol: this.data.activity?.SymbolProfile?.symbol
        })
        .pipe(takeUntil(this.unsubscribeSubject))
        .subscribe(({ marketPrice }) => {
          this.currentMarketPrice = marketPrice;

          this.changeDetectorRef.markForCheck();
        });
    }
  }

  public applyCurrentMarketPrice() {
    this.activityForm.patchValue({
      currencyOfUnitPrice: this.activityForm.controls['currency'].value,
      unitPriceInCustomCurrency: this.currentMarketPrice
    });
  }

  public displayFn(aLookupItem: LookupItem) {
    return aLookupItem?.symbol ?? '';
  }

  public onAddTag(event: MatAutocompleteSelectedEvent) {
    this.activityForm.controls['tags'].setValue([
      ...(this.activityForm.controls['tags'].value ?? []),
      this.tags.find(({ id }) => {
        return id === event.option.value;
      })
    ]);
    this.tagInput.nativeElement.value = '';
  }

  public onBlurSymbol() {
    const currentLookupItem = this.filteredLookupItems.find((lookupItem) => {
      return (
        lookupItem.symbol ===
        this.activityForm.controls['searchSymbol'].value.symbol
      );
    });

    if (currentLookupItem) {
      this.updateSymbol(currentLookupItem.symbol);
    } else {
      this.activityForm.controls['searchSymbol'].setErrors({ incorrect: true });

      this.data.activity.SymbolProfile = null;
    }

    this.changeDetectorRef.markForCheck();
  }

  public onCancel() {
    this.dialogRef.close();
  }

  public onRemoveTag(aTag: Tag) {
    this.activityForm.controls['tags'].setValue(
      this.activityForm.controls['tags'].value.filter(({ id }) => {
        return id !== aTag.id;
      })
    );
  }

  public onSubmit() {
    const activity: CreateOrderDto | UpdateOrderDto = {
      accountId: this.activityForm.controls['accountId'].value,
      assetClass: this.activityForm.controls['assetClass'].value,
      assetSubClass: this.activityForm.controls['assetSubClass'].value,
      comment: this.activityForm.controls['comment'].value,
      currency: this.activityForm.controls['currency'].value,
      date: this.activityForm.controls['date'].value,
      dataSource: this.activityForm.controls['dataSource'].value,
      fee: this.activityForm.controls['fee'].value,
      quantity: this.activityForm.controls['quantity'].value,
      symbol:
        this.activityForm.controls['searchSymbol'].value.symbol === undefined ||
        isUUID(this.activityForm.controls['searchSymbol'].value.symbol)
          ? this.activityForm.controls['name'].value
          : this.activityForm.controls['searchSymbol'].value.symbol,
      tags: this.activityForm.controls['tags'].value,
      type: this.activityForm.controls['type'].value,
      unitPrice: this.activityForm.controls['unitPrice'].value
    };

    if (this.data.activity.id) {
      (activity as UpdateOrderDto).id = this.data.activity.id;
    } else {
      (activity as CreateOrderDto).updateAccountBalance =
        this.activityForm.controls['updateAccountBalance'].value;
    }

    this.dialogRef.close({ activity });
  }

  public onUpdateSymbol(event: MatAutocompleteSelectedEvent) {
    this.activityForm.controls['dataSource'].setValue(
      event.option.value.dataSource
    );
    this.updateSymbol(event.option.value.symbol);
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }

  private filterTags(aTags: Tag[]) {
    const tagIds = aTags.map((tag) => {
      return tag.id;
    });

    return this.tags.filter((tag) => {
      return !tagIds.includes(tag.id);
    });
  }

  private updateSymbol(symbol: string) {
    this.isLoading = true;

    this.activityForm.controls['searchSymbol'].setErrors(null);
    this.activityForm.controls['searchSymbol'].setValue({ symbol });

    this.changeDetectorRef.markForCheck();

    this.dataService
      .fetchSymbolItem({
        dataSource: this.activityForm.controls['dataSource'].value,
        symbol: this.activityForm.controls['searchSymbol'].value.symbol
      })
      .pipe(
        catchError(() => {
          this.data.activity.SymbolProfile = null;

          this.isLoading = false;

          this.changeDetectorRef.markForCheck();

          return EMPTY;
        }),
        takeUntil(this.unsubscribeSubject)
      )
      .subscribe(({ currency, dataSource, marketPrice }) => {
        this.activityForm.controls['currency'].setValue(currency);
        this.activityForm.controls['currencyOfFee'].setValue(currency);
        this.activityForm.controls['currencyOfUnitPrice'].setValue(currency);
        this.activityForm.controls['dataSource'].setValue(dataSource);

        this.currentMarketPrice = marketPrice;

        this.isLoading = false;

        this.changeDetectorRef.markForCheck();
      });
  }
}
