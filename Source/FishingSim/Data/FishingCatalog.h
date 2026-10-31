#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "FishingCatalog.generated.h"

class UTackleItemData;
class UFishSpeciesData;
class ULocationData;

/**
 * Единый каталог контента. Профиль игрока ищет предметы по ItemId именно здесь.
 * Путь по умолчанию: /Game/Data/DA_FishingCatalog (см. UFishingSettings).
 */
UCLASS(BlueprintType)
class FISHINGSIM_API UFishingCatalog : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Catalog")
	TArray<TObjectPtr<UTackleItemData>> Items;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Catalog")
	TArray<TObjectPtr<UFishSpeciesData>> Species;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Catalog")
	TArray<TObjectPtr<ULocationData>> Locations;

	/** Что получает новый игрок: ItemId -> количество. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Starter")
	TMap<FName, int32> StarterItems;

	/** Что сразу надето на новом профиле. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Starter")
	TArray<FName> StarterEquipped;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Starter", meta = (ClampMin = "0"))
	int32 StarterSoftCurrency = 500;

	UFUNCTION(BlueprintPure, Category = "Catalog")
	UTackleItemData* FindItem(FName InItemId) const;

	UFUNCTION(BlueprintPure, Category = "Catalog")
	UFishSpeciesData* FindSpecies(FName InSpeciesId) const;

	UFUNCTION(BlueprintPure, Category = "Catalog")
	ULocationData* FindLocation(FName InLocationId) const;
};
