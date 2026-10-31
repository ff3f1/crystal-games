#include "Store/FishingStoreSubsystem.h"
#include "Economy/FishingProfileSubsystem.h"
#include "Economy/FishingSaveGame.h"
#include "Data/FishingCatalog.h"
#include "Data/TackleData.h"
#include "Data/LocationData.h"
#include "Core/FishingSettings.h"
#include "FishingSim.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GenericPlatform/GenericPlatformMisc.h"
#include "HAL/PlatformMisc.h"
#include "HAL/PlatformProcess.h"
#include "HAL/PlatformTime.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Misc/CommandLine.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

#define LOCTEXT_NAMESPACE "FishingStore"

UFishingStoreSubsystem* UFishingStoreSubsystem::Get(const UObject* WorldContextObject)
{
	if (!GEngine || !WorldContextObject)
	{
		return nullptr;
	}
	const UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull);
	UGameInstance* GI = World ? World->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UFishingStoreSubsystem>() : nullptr;
}

void UFishingStoreSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UFishingProfileSubsystem::StaticClass());
	Super::Initialize(Collection);
	Login();
}

void UFishingStoreSubsystem::Deinitialize()
{
	if (UGameInstance* GI = GetGameInstance())
	{
		GI->GetTimerManager().ClearTimer(PollTimer);
	}
	Super::Deinitialize();
}

UFishingProfileSubsystem* UFishingStoreSubsystem::GetProfile() const
{
	UGameInstance* GI = GetGameInstance();
	return GI ? GI->GetSubsystem<UFishingProfileSubsystem>() : nullptr;
}

bool UFishingStoreSubsystem::IsOffline() const
{
#if UE_BUILD_SHIPPING
	return false;
#else
	return UFishingSettings::Get()->bOfflineDevStore;
#endif
}

// ============================================================================
// HTTP
// ============================================================================

void UFishingStoreSubsystem::SendRequest(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, FStoreJsonCallback Callback)
{
	const UFishingSettings* Settings = UFishingSettings::Get();

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Settings->BackendBaseUrl + Path);
	Request->SetVerb(Verb);
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
	if (!SessionToken.IsEmpty())
	{
		Request->SetHeader(TEXT("Authorization"), FString::Printf(TEXT("Bearer %s"), *SessionToken));
	}
	if (Body.IsValid())
	{
		FString Content;
		const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Content);
		FJsonSerializer::Serialize(Body.ToSharedRef(), Writer);
		Request->SetContentAsString(Content);
	}

	TWeakObjectPtr<UFishingStoreSubsystem> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda(
		[WeakThis, Callback](FHttpRequestPtr /*Req*/, FHttpResponsePtr Response, bool bConnected)
		{
			if (!WeakThis.IsValid())
			{
				return;
			}
			const int32 Code = Response.IsValid() ? Response->GetResponseCode() : 0;
			TSharedPtr<FJsonObject> Json;
			if (bConnected && Response.IsValid())
			{
				const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
				FJsonSerializer::Deserialize(Reader, Json);
			}
			if (!Json.IsValid())
			{
				Json = MakeShared<FJsonObject>();
			}
			Callback(bConnected && Code >= 200 && Code < 300, Code, Json);
		});
	Request->ProcessRequest();
}

TSharedPtr<FJsonObject> UFishingStoreSubsystem::CollectLauncherParams() const
{
	// Лаунчер VK Play передаёт данные пользователя параметрами командной строки.
	// Точные имена параметров — в документации VK Play; сервер проверяет их подпись.
	TSharedPtr<FJsonObject> Params = MakeShared<FJsonObject>();
	TArray<FString> Tokens;
	TArray<FString> Switches;
	FCommandLine::Parse(FCommandLine::Get(), Tokens, Switches);

	const TArray<FString>& Whitelist = UFishingSettings::Get()->LauncherParamWhitelist;
	for (const FString& Switch : Switches)
	{
		FString Key;
		FString Value;
		if (!Switch.Split(TEXT("="), &Key, &Value))
		{
			continue;
		}
		if (Whitelist.Num() > 0 && !Whitelist.Contains(Key))
		{
			continue;
		}
		Params->SetStringField(Key, Value.TrimQuotes());
	}
	return Params;
}

// ============================================================================
// Авторизация и профиль
// ============================================================================

void UFishingStoreSubsystem::Login()
{
	if (IsOffline())
	{
		LoginState = EStoreLoginState::OfflineDev;
		InitOfflineProducts();
		PushOfflineStateToProfile();
		UE_LOG(LogFishing, Log, TEXT("Магазин: офлайн-режим разработки (bOfflineDevStore)."));
		OnLoginFinished.Broadcast(true);
		return;
	}

	LoginState = EStoreLoginState::LoggingIn;
	const TSharedPtr<FJsonObject> LaunchParams = CollectLauncherParams();
	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	FString Path;

	if (LaunchParams->Values.Num() > 0)
	{
		Body->SetObjectField(TEXT("launchParams"), LaunchParams);
		Path = TEXT("/api/auth/vkplay");
	}
	else
	{
#if UE_BUILD_SHIPPING
		UE_LOG(LogFishing, Warning, TEXT("Магазин: игра запущена не из лаунчера VK Play — покупки недоступны."));
		LoginState = EStoreLoginState::Failed;
		OnLoginFinished.Broadcast(false);
		return;
#else
		// Для отладки с сервером в DEV_MODE=1
		Body->SetStringField(TEXT("deviceId"), FPlatformMisc::GetLoginId());
		Path = TEXT("/api/auth/dev");
#endif
	}

	SendRequest(TEXT("POST"), Path, Body, [this](bool bOk, int32 Code, TSharedPtr<FJsonObject> Json)
	{
		FString Token;
		if (bOk && Json->TryGetStringField(TEXT("token"), Token) && !Token.IsEmpty())
		{
			SessionToken = Token;
			LoginState = EStoreLoginState::LoggedIn;
			RefreshProfile();
			RefreshProducts();
			OnLoginFinished.Broadcast(true);
		}
		else
		{
			UE_LOG(LogFishing, Warning, TEXT("Магазин: ошибка авторизации (HTTP %d)."), Code);
			LoginState = EStoreLoginState::Failed;
			OnLoginFinished.Broadcast(false);
		}
	});
}

void UFishingStoreSubsystem::RefreshProfile()
{
	if (IsOffline())
	{
		PushOfflineStateToProfile();
		return;
	}
	if (LoginState != EStoreLoginState::LoggedIn)
	{
		return;
	}
	SendRequest(TEXT("GET"), TEXT("/api/profile"), nullptr, [this](bool bOk, int32 Code, TSharedPtr<FJsonObject> Json)
	{
		if (bOk)
		{
			ApplyProfileJson(Json);
		}
		else
		{
			UE_LOG(LogFishing, Warning, TEXT("Магазин: не удалось получить профиль (HTTP %d)."), Code);
		}
	});
}

void UFishingStoreSubsystem::ApplyProfileJson(const TSharedPtr<FJsonObject>& Json)
{
	UFishingProfileSubsystem* Profile = GetProfile();
	if (!Profile || !Json.IsValid())
	{
		return;
	}

	double Balance = 0.0;
	Json->TryGetNumberField(TEXT("premiumBalance"), Balance);

	TArray<FName> ServerEntitlements;
	const TArray<TSharedPtr<FJsonValue>>* EntArray = nullptr;
	if (Json->TryGetArrayField(TEXT("entitlements"), EntArray) && EntArray)
	{
		for (const TSharedPtr<FJsonValue>& Value : *EntArray)
		{
			if (Value.IsValid())
			{
				ServerEntitlements.Add(FName(*Value->AsString()));
			}
		}
	}

	FDateTime ServerPremiumUntil;
	FString UntilString;
	if (Json->TryGetStringField(TEXT("premiumUntil"), UntilString) && !UntilString.IsEmpty())
	{
		FDateTime::ParseIso8601(*UntilString, ServerPremiumUntil);
	}

	Profile->ApplyServerState(static_cast<int64>(Balance), ServerEntitlements, ServerPremiumUntil);

	// Выдачи (расходники, купленные за золото или в наборах)
	TArray<TSharedPtr<FJsonValue>> AckIds;
	const TArray<TSharedPtr<FJsonValue>>* Grants = nullptr;
	if (Json->TryGetArrayField(TEXT("grants"), Grants) && Grants)
	{
		for (const TSharedPtr<FJsonValue>& GrantValue : *Grants)
		{
			const TSharedPtr<FJsonObject> Grant = GrantValue.IsValid() ? GrantValue->AsObject() : nullptr;
			if (!Grant.IsValid())
			{
				continue;
			}
			FString GrantId;
			FString ItemId;
			double Count = 1.0;
			Grant->TryGetStringField(TEXT("id"), GrantId);
			Grant->TryGetStringField(TEXT("itemId"), ItemId);
			Grant->TryGetNumberField(TEXT("count"), Count);
			if (!GrantId.IsEmpty() && !ItemId.IsEmpty())
			{
				Profile->ApplyGrant(GrantId, FName(*ItemId), FMath::Max(1, FMath::RoundToInt(static_cast<float>(Count))));
				AckIds.Add(MakeShared<FJsonValueString>(GrantId));
			}
		}
	}

	if (AckIds.Num() > 0)
	{
		TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
		Body->SetArrayField(TEXT("ids"), AckIds);
		SendRequest(TEXT("POST"), TEXT("/api/grants/ack"), Body, [](bool, int32, TSharedPtr<FJsonObject>) {});
	}
}

void UFishingStoreSubsystem::RefreshProducts()
{
	if (IsOffline())
	{
		InitOfflineProducts();
		OnProductsUpdated.Broadcast();
		return;
	}
	SendRequest(TEXT("GET"), TEXT("/api/store/products"), nullptr, [this](bool bOk, int32 Code, TSharedPtr<FJsonObject> Json)
	{
		const TArray<TSharedPtr<FJsonValue>>* List = nullptr;
		if (!bOk || !Json->TryGetArrayField(TEXT("products"), List) || !List)
		{
			UE_LOG(LogFishing, Warning, TEXT("Магазин: не удалось загрузить товары (HTTP %d)."), Code);
			return;
		}
		Products.Reset();
		for (const TSharedPtr<FJsonValue>& Value : *List)
		{
			const TSharedPtr<FJsonObject> Obj = Value.IsValid() ? Value->AsObject() : nullptr;
			if (!Obj.IsValid())
			{
				continue;
			}
			FStoreProduct& Product = Products.AddDefaulted_GetRef();
			FString Text;
			double Number = 0.0;
			Obj->TryGetStringField(TEXT("id"), Product.ProductId);
			if (Obj->TryGetStringField(TEXT("title"), Text)) { Product.Title = FText::FromString(Text); }
			if (Obj->TryGetStringField(TEXT("description"), Text)) { Product.Description = FText::FromString(Text); }
			if (Obj->TryGetNumberField(TEXT("priceRub"), Number)) { Product.PriceRub = FMath::RoundToInt(static_cast<float>(Number)); }
			if (Obj->TryGetNumberField(TEXT("premiumAmount"), Number)) { Product.PremiumAmount = FMath::RoundToInt(static_cast<float>(Number)); }
			if (Obj->TryGetNumberField(TEXT("premiumDays"), Number)) { Product.PremiumDays = FMath::RoundToInt(static_cast<float>(Number)); }
		}
		OnProductsUpdated.Broadcast();
	});
}

// ============================================================================
// Покупки
// ============================================================================

void UFishingStoreSubsystem::BuyProduct(const FString& ProductId)
{
	if (IsOffline())
	{
		OfflineBuyProduct(ProductId);
		return;
	}
	if (IsPurchaseInProgress())
	{
		OnPurchaseFinished.Broadcast(ProductId, false, LOCTEXT("PurchaseBusy", "Дождитесь завершения предыдущей покупки"));
		return;
	}
	if (LoginState != EStoreLoginState::LoggedIn)
	{
		OnPurchaseFinished.Broadcast(ProductId, false, LOCTEXT("NotLoggedIn", "Нет связи с сервером VK Play"));
		return;
	}

	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("productId"), ProductId);

	SendRequest(TEXT("POST"), TEXT("/api/orders"), Body, [this, ProductId](bool bOk, int32 Code, TSharedPtr<FJsonObject> Json)
	{
		FString OrderId;
		FString PaymentUrl;
		if (!bOk || !Json->TryGetStringField(TEXT("orderId"), OrderId) || !Json->TryGetStringField(TEXT("paymentUrl"), PaymentUrl))
		{
			UE_LOG(LogFishing, Warning, TEXT("Магазин: не удалось создать заказ (HTTP %d)."), Code);
			OnPurchaseFinished.Broadcast(ProductId, false, LOCTEXT("OrderFailed", "Не удалось создать заказ"));
			return;
		}

		PendingOrderId = OrderId;
		PendingProductId = ProductId;
		PendingOrderStartTime = FPlatformTime::Seconds();
		bPollInFlight = false;

		// Окно оплаты VK Play (в браузере или оверлее лаунчера)
		FPlatformProcess::LaunchURL(*PaymentUrl, nullptr, nullptr);

		if (UGameInstance* GI = GetGameInstance())
		{
			GI->GetTimerManager().SetTimer(PollTimer, this, &UFishingStoreSubsystem::PollPendingOrder,
				UFishingSettings::Get()->OrderPollIntervalSec, true);
		}
	});
}

void UFishingStoreSubsystem::PollPendingOrder()
{
	if (PendingOrderId.IsEmpty() || bPollInFlight)
	{
		return;
	}
	if (FPlatformTime::Seconds() - PendingOrderStartTime > UFishingSettings::Get()->OrderPollTimeoutSec)
	{
		FinishPendingOrder(false, LOCTEXT("OrderTimeout", "Оплата не подтверждена. Если деньги списаны — покупка придёт при следующем входе."));
		return;
	}

	bPollInFlight = true;
	SendRequest(TEXT("GET"), FString::Printf(TEXT("/api/orders/%s"), *PendingOrderId), nullptr,
		[this](bool bOk, int32 /*Code*/, TSharedPtr<FJsonObject> Json)
	{
		bPollInFlight = false;
		FString Status;
		if (!bOk || !Json->TryGetStringField(TEXT("status"), Status))
		{
			return; // сеть моргнула — попробуем на следующем тике
		}
		if (Status == TEXT("paid"))
		{
			RefreshProfile();
			FinishPendingOrder(true, LOCTEXT("OrderPaid", "Покупка зачислена. Спасибо!"));
		}
		else if (Status == TEXT("failed") || Status == TEXT("canceled"))
		{
			FinishPendingOrder(false, LOCTEXT("OrderCanceled", "Оплата отменена"));
		}
	});
}

void UFishingStoreSubsystem::FinishPendingOrder(bool bSuccess, const FText& Message)
{
	if (UGameInstance* GI = GetGameInstance())
	{
		GI->GetTimerManager().ClearTimer(PollTimer);
	}
	const FString ProductId = PendingProductId;
	PendingOrderId.Reset();
	PendingProductId.Reset();
	bPollInFlight = false;
	OnPurchaseFinished.Broadcast(ProductId, bSuccess, Message);
}

void UFishingStoreSubsystem::BuyWithPremium(FName ItemOrLocationId)
{
	const FString IdString = ItemOrLocationId.ToString();
	if (IsOffline())
	{
		OfflineBuyWithPremium(ItemOrLocationId);
		return;
	}
	if (LoginState != EStoreLoginState::LoggedIn)
	{
		OnPurchaseFinished.Broadcast(IdString, false, LOCTEXT("NotLoggedIn2", "Нет связи с сервером VK Play"));
		return;
	}

	TSharedPtr<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("itemId"), IdString);
	SendRequest(TEXT("POST"), TEXT("/api/store/buy"), Body, [this, IdString](bool bOk, int32 Code, TSharedPtr<FJsonObject> Json)
	{
		if (bOk)
		{
			RefreshProfile();
			OnPurchaseFinished.Broadcast(IdString, true, GetPurchaseResultText(EStorePurchaseResult::Success));
			return;
		}
		EStorePurchaseResult Result = EStorePurchaseResult::Failed;
		if (Code == 402) { Result = EStorePurchaseResult::NotEnoughCurrency; }
		else if (Code == 409) { Result = EStorePurchaseResult::AlreadyOwned; }
		else if (Code == 404) { Result = EStorePurchaseResult::NotForSale; }
		OnPurchaseFinished.Broadcast(IdString, false, GetPurchaseResultText(Result));
	});
}

FText UFishingStoreSubsystem::GetPurchaseResultText(EStorePurchaseResult Result)
{
	switch (Result)
	{
	case EStorePurchaseResult::Success:				return LOCTEXT("ResSuccess", "Покупка совершена");
	case EStorePurchaseResult::NotEnoughCurrency:	return LOCTEXT("ResNoMoney", "Недостаточно средств");
	case EStorePurchaseResult::LevelTooLow:			return LOCTEXT("ResLevel", "Нужен более высокий уровень");
	case EStorePurchaseResult::PremiumOnly:			return LOCTEXT("ResPremium", "Продаётся только за золото");
	case EStorePurchaseResult::NotForSale:			return LOCTEXT("ResNotForSale", "Не продаётся");
	case EStorePurchaseResult::UnknownItem:			return LOCTEXT("ResUnknown", "Неизвестный товар");
	case EStorePurchaseResult::AlreadyOwned:		return LOCTEXT("ResOwned", "Уже есть");
	case EStorePurchaseResult::Pending:				return LOCTEXT("ResPending", "Ожидание оплаты…");
	default:										return LOCTEXT("ResFailed", "Ошибка покупки");
	}
}

// ============================================================================
// Офлайн-режим разработки (без сервера). В Shipping не используется.
// ============================================================================

void UFishingStoreSubsystem::InitOfflineProducts()
{
	Products.Reset();
	auto Add = [this](const TCHAR* Id, const FText& InTitle, int32 Rub, int32 Gold, int32 Days)
	{
		FStoreProduct& Product = Products.AddDefaulted_GetRef();
		Product.ProductId = Id;
		Product.Title = InTitle;
		Product.PriceRub = Rub;
		Product.PremiumAmount = Gold;
		Product.PremiumDays = Days;
	};
	// Держи в синхроне с Backend/products.json
	Add(TEXT("gold_100"), LOCTEXT("PGold100", "100 золота"), 99, 100, 0);
	Add(TEXT("gold_550"), LOCTEXT("PGold550", "550 золота (+10%)"), 449, 550, 0);
	Add(TEXT("gold_1200"), LOCTEXT("PGold1200", "1200 золота (+20%)"), 899, 1200, 0);
	Add(TEXT("premium_30d"), LOCTEXT("PPremium30", "Премиум-аккаунт на 30 дней"), 299, 0, 30);
}

void UFishingStoreSubsystem::PushOfflineStateToProfile()
{
	UFishingProfileSubsystem* Profile = GetProfile();
	UFishingSaveGame* SaveData = Profile ? Profile->GetSaveData() : nullptr;
	if (SaveData)
	{
		Profile->ApplyServerState(SaveData->DevPremiumCurrency, SaveData->DevEntitlements, SaveData->DevPremiumUntil);
	}
}

void UFishingStoreSubsystem::OfflineBuyProduct(const FString& ProductId)
{
	UFishingProfileSubsystem* Profile = GetProfile();
	UFishingSaveGame* SaveData = Profile ? Profile->GetSaveData() : nullptr;
	const FStoreProduct* Product = Products.FindByPredicate([&ProductId](const FStoreProduct& P) { return P.ProductId == ProductId; });
	if (!SaveData || !Product)
	{
		OnPurchaseFinished.Broadcast(ProductId, false, GetPurchaseResultText(EStorePurchaseResult::UnknownItem));
		return;
	}

	SaveData->DevPremiumCurrency += Product->PremiumAmount;
	if (Product->PremiumDays > 0)
	{
		const FDateTime Now = FDateTime::UtcNow();
		const FDateTime From = SaveData->DevPremiumUntil > Now ? SaveData->DevPremiumUntil : Now;
		SaveData->DevPremiumUntil = From + FTimespan::FromDays(Product->PremiumDays);
	}
	PushOfflineStateToProfile();
	Profile->SaveProfile();
	OnPurchaseFinished.Broadcast(ProductId, true, LOCTEXT("OfflinePaid", "[ТЕСТ] Покупка зачислена без оплаты"));
}

void UFishingStoreSubsystem::OfflineBuyWithPremium(FName ItemOrLocationId)
{
	const FString IdString = ItemOrLocationId.ToString();
	UFishingProfileSubsystem* Profile = GetProfile();
	UFishingSaveGame* SaveData = Profile ? Profile->GetSaveData() : nullptr;
	const UFishingCatalog* Catalog = Profile ? Profile->GetCatalog() : nullptr;
	if (!SaveData || !Catalog)
	{
		OnPurchaseFinished.Broadcast(IdString, false, GetPurchaseResultText(EStorePurchaseResult::Failed));
		return;
	}

	int32 Price = 0;
	int32 Quantity = 1;
	bool bPermanent = false;
	if (const UTackleItemData* Item = Catalog->FindItem(ItemOrLocationId))
	{
		Price = Item->PricePremium;
		Quantity = Item->PurchaseQuantity;
		bPermanent = Item->Slot == ETackleSlot::Rod || Item->Slot == ETackleSlot::Reel || Item->Slot == ETackleSlot::Line;
	}
	else if (const ULocationData* Location = Catalog->FindLocation(ItemOrLocationId))
	{
		Price = Location->PricePremium;
		bPermanent = true;
	}

	EStorePurchaseResult Result = EStorePurchaseResult::Success;
	if (Price <= 0)
	{
		Result = EStorePurchaseResult::NotForSale;
	}
	else if (bPermanent && SaveData->DevEntitlements.Contains(ItemOrLocationId))
	{
		Result = EStorePurchaseResult::AlreadyOwned;
	}
	else if (SaveData->DevPremiumCurrency < Price)
	{
		Result = EStorePurchaseResult::NotEnoughCurrency;
	}

	if (Result != EStorePurchaseResult::Success)
	{
		OnPurchaseFinished.Broadcast(IdString, false, GetPurchaseResultText(Result));
		return;
	}

	SaveData->DevPremiumCurrency -= Price;
	if (bPermanent)
	{
		SaveData->DevEntitlements.AddUnique(ItemOrLocationId);
	}
	else
	{
		Profile->AddItem(ItemOrLocationId, Quantity);
	}
	PushOfflineStateToProfile();
	Profile->SaveProfile();
	OnPurchaseFinished.Broadcast(IdString, true, GetPurchaseResultText(EStorePurchaseResult::Success));
}

#undef LOCTEXT_NAMESPACE
