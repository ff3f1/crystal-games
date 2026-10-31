#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "LocationData.generated.h"

class UTexture2D;
class UWorld;

/** Водоём (уровень). Может открываться по уровню, за серебро или за золото (VK Play). */
UCLASS(BlueprintType)
class FISHINGSIM_API ULocationData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Location")
	FName LocationId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Location")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Location", meta = (MultiLine = true))
	FText Description;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Location")
	TSoftObjectPtr<UTexture2D> Image;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Location")
	TSoftObjectPtr<UWorld> Map;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "1"))
	int32 RequiredLevel = 1;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "0"))
	int32 PriceSoft = 0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "0"))
	int32 PricePremium = 0;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop")
	bool bPremiumOnly = false;

	UFUNCTION(BlueprintPure, Category = "Location")
	bool IsFree() const { return PriceSoft <= 0 && PricePremium <= 0; }
};
