#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Core/FishingTypes.h"
#include "Data/TackleData.h"
#include "FishingProfileSubsystem.generated.h"

class UFishingCatalog;
class UFishingSaveGame;
class ULocationData;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnProfileChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnProfileLevelUp, int32, NewLevel);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnProfileCatchRegistered, const FCatchRecord&, Catch, bool, bNewRecord);

/**
 * Профиль игрока: серебро, уровень/опыт, снаряжение, садок, рекорды, открытые водоёмы.
 * Премиум-валюта (золото) и покупки VK Play приходят с сервера через UFishingStoreSubsystem.
 */
UCLASS()
class FISHINGSIM_API UFishingProfileSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile", meta = (WorldContext = "WorldContextObject"))
	static UFishingProfileSubsystem* Get(const UObject* WorldContextObject);

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	UFishingCatalog* GetCatalog() const { return Catalog; }

	// ---------------- Валюта ----------------

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	int64 GetSoftCurrency() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	int64 GetPremiumCurrency() const { return PremiumCurrency; }

	UFUNCTION(BlueprintCallable, Category = "Fishing|Profile")
	void AddSoftCurrency(int64 Amount);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Profile")
	bool SpendSoftCurrency(int64 Amount);

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	bool IsPremiumAccountActive() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	FDateTime GetPremiumUntil() const { return PremiumUntil; }

	/** x1.5 к серебру и опыту с премиум-аккаунтом. */
	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	float GetRewardMultiplier() const;

	// ---------------- Уровень ----------------

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	int32 GetLevel() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	int32 GetXp() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Profile")
	static int32 GetXpRequiredForLevel(int32 InLevel);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Profile")
	void AddXp(int32 Amount);

	// ---------------- Предметы ----------------

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	int32 GetItemCount(FName ItemId) const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	bool IsItemBroken(FName ItemId) const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	bool IsItemUsable(FName ItemId) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	void AddItem(FName ItemId, int32 Count);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	bool ConsumeItem(FName ItemId, int32 Count = 1);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	void MarkItemBroken(FName ItemId);

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	int32 GetRepairCost(FName ItemId) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	EStorePurchaseResult RepairItem(FName ItemId);

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	TArray<UTackleItemData*> GetOwnedItems(ETackleSlot Slot) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	bool EquipItem(FName ItemId);

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	UTackleItemData* GetEquippedItem(ETackleSlot Slot) const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Inventory")
	FTackleLoadout BuildEquippedLoadout() const;

	/** Надеть следующий предмет этого слота (быстрая смена приманки и т.п.). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Inventory")
	bool EquipNextInSlot(ETackleSlot Slot);

	// ---------------- Магазин (серебро) ----------------

	UFUNCTION(BlueprintPure, Category = "Fishing|Shop")
	EStorePurchaseResult CanBuyWithSoft(FName ItemId) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Shop")
	EStorePurchaseResult BuyWithSoft(FName ItemId);

	// ---------------- Водоёмы ----------------

	UFUNCTION(BlueprintPure, Category = "Fishing|Locations")
	bool IsLocationUnlocked(FName LocationId) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Locations")
	EStorePurchaseResult UnlockLocationWithSoft(FName LocationId);

	// ---------------- Улов ----------------

	UFUNCTION(BlueprintCallable, Category = "Fishing|Catch")
	void FillCatchValue(UPARAM(ref) FCatchRecord& Catch) const;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Catch")
	void RegisterCatch(const FCatchRecord& Catch, bool bKeepInNet);

	/** Продать весь садок. Возвращает выручку. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Catch")
	int64 SellKeepnet();

	UFUNCTION(BlueprintPure, Category = "Fishing|Catch")
	TArray<FCatchRecord> GetKeepnet() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Catch")
	TArray<FCatchRecord> GetRecords() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Catch")
	int32 GetTotalCatches() const;

	// ---------------- Синхронизация с сервером (вызывает UFishingStoreSubsystem) ----------------

	void ApplyServerState(int64 InPremiumCurrency, const TArray<FName>& InEntitlements, const FDateTime& InPremiumUntil);

	/** Применить выдачу с сервера. false — уже применена ранее. */
	bool ApplyGrant(const FString& GrantId, FName ItemId, int32 Count);

	bool HasEntitlement(FName ItemId) const { return Entitlements.Contains(ItemId); }

	UFishingSaveGame* GetSaveData() const { return Save; }

	// ---------------- Сохранение ----------------

	UFUNCTION(BlueprintCallable, Category = "Fishing|Profile")
	void SaveProfile();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Profile")
	void ResetProfile();

	// ---------------- События ----------------

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnProfileChanged OnCurrencyChanged;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnProfileChanged OnInventoryChanged;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnProfileChanged OnLoadoutChanged;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnProfileLevelUp OnLevelUp;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnProfileCatchRegistered OnCatchRegistered;

private:
	void GiveStarterKit();
	void ValidateEquipped();

	UPROPERTY(Transient)
	TObjectPtr<UFishingSaveGame> Save;

	UPROPERTY(Transient)
	TObjectPtr<UFishingCatalog> Catalog;

	int64 PremiumCurrency = 0;
	TSet<FName> Entitlements;
	FDateTime PremiumUntil;
};
