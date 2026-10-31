#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/FishingTypes.h"
#include "TimerManager.h"
#include "FishingStoreSubsystem.generated.h"

class FJsonObject;
class UFishingProfileSubsystem;

/** Ответ сервера: (успех, HTTP-код, JSON). */
using FStoreJsonCallback = TFunction<void(bool, int32, TSharedPtr<FJsonObject>)>;

UENUM(BlueprintType)
enum class EStoreLoginState : uint8
{
	NotLoggedIn,
	LoggingIn,
	LoggedIn,
	OfflineDev,
	Failed
};

/** Товар за реальные деньги (продаётся через VK Play). Список приходит с сервера. */
USTRUCT(BlueprintType)
struct FStoreProduct
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Store")
	FString ProductId;

	UPROPERTY(BlueprintReadOnly, Category = "Store")
	FText Title;

	UPROPERTY(BlueprintReadOnly, Category = "Store")
	FText Description;

	/** Цена для отображения (рубли). Реальную цену списывает VK Play. */
	UPROPERTY(BlueprintReadOnly, Category = "Store")
	int32 PriceRub = 0;

	/** Сколько золота даёт. */
	UPROPERTY(BlueprintReadOnly, Category = "Store")
	int32 PremiumAmount = 0;

	/** Дней премиум-аккаунта. */
	UPROPERTY(BlueprintReadOnly, Category = "Store")
	int32 PremiumDays = 0;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStoreLoginFinished, bool, bSuccess);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnStoreProductsUpdated);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnStorePurchaseFinished, const FString&, ProductOrItemId, bool, bSuccess, const FText&, Message);

/**
 * Магазин и монетизация.
 *
 * Схема покупки за реальные деньги (VK Play):
 *   1. Игра -> сервер: POST /api/orders {productId}         -> {orderId, paymentUrl}
 *   2. Игра открывает paymentUrl (окно оплаты VK Play)
 *   3. VK Play -> сервер: уведомление об оплате (callback), сервер проверяет подпись и начисляет
 *   4. Игра опрашивает GET /api/orders/{id}, получив "paid" — обновляет профиль
 *
 * Клиенту никогда не доверяем: баланс золота, вечные покупки и выдачи хранит сервер.
 * В режиме bOfflineDevStore всё работает локально без сервера (только для разработки).
 */
UCLASS()
class FISHINGSIM_API UFishingStoreSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintPure, Category = "Fishing|Store", meta = (WorldContext = "WorldContextObject"))
	static UFishingStoreSubsystem* Get(const UObject* WorldContextObject);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Store")
	void Login();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Store")
	void RefreshProfile();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Store")
	void RefreshProducts();

	/** Покупка за реальные деньги через VK Play. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Store")
	void BuyProduct(const FString& ProductId);

	/** Покупка предмета или водоёма за золото (списание на сервере). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Store")
	void BuyWithPremium(FName ItemOrLocationId);

	UFUNCTION(BlueprintPure, Category = "Fishing|Store")
	TArray<FStoreProduct> GetProducts() const { return Products; }

	UFUNCTION(BlueprintPure, Category = "Fishing|Store")
	EStoreLoginState GetLoginState() const { return LoginState; }

	UFUNCTION(BlueprintPure, Category = "Fishing|Store")
	bool IsPurchaseInProgress() const { return !PendingOrderId.IsEmpty(); }

	UFUNCTION(BlueprintPure, Category = "Fishing|Store")
	static FText GetPurchaseResultText(EStorePurchaseResult Result);

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Store")
	FOnStoreLoginFinished OnLoginFinished;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Store")
	FOnStoreProductsUpdated OnProductsUpdated;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Store")
	FOnStorePurchaseFinished OnPurchaseFinished;

private:
	bool IsOffline() const;
	void SendRequest(const FString& Verb, const FString& Path, const TSharedPtr<FJsonObject>& Body, FStoreJsonCallback Callback);
	TSharedPtr<FJsonObject> CollectLauncherParams() const;
	void ApplyProfileJson(const TSharedPtr<FJsonObject>& Json);
	void PollPendingOrder();
	void FinishPendingOrder(bool bSuccess, const FText& Message);
	UFishingProfileSubsystem* GetProfile() const;

	// Офлайн-режим разработки
	void InitOfflineProducts();
	void OfflineBuyProduct(const FString& ProductId);
	void OfflineBuyWithPremium(FName ItemOrLocationId);
	void PushOfflineStateToProfile();

	UPROPERTY(Transient)
	TArray<FStoreProduct> Products;

	EStoreLoginState LoginState = EStoreLoginState::NotLoggedIn;
	FString SessionToken;
	FString PendingOrderId;
	FString PendingProductId;
	double PendingOrderStartTime = 0.0;
	bool bPollInFlight = false;
	FTimerHandle PollTimer;
};
