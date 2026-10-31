#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/FishingTypes.h"
#include "TackleData.generated.h"

class UStaticMesh;
class UTexture2D;

/** Базовый класс любого предмета снаряжения (удилище, катушка, леска, крючок, наживка). */
UCLASS(Abstract, BlueprintType)
class FISHINGSIM_API UTackleItemData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	/** Уникальный ID (сохранения, сервер, products.json). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FName ItemId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item", meta = (MultiLine = true))
	FText Description;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	TSoftObjectPtr<UTexture2D> Icon;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Item")
	TSoftObjectPtr<UStaticMesh> Mesh;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Item")
	ETackleSlot Slot = ETackleSlot::Rod;

	// ---------------- Магазин ----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "1"))
	int32 RequiredLevel = 1;

	/** Цена в серебре (игровая валюта). 0 — не продаётся за серебро. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "0"))
	int32 PriceSoft = 100;

	/** Цена в золоте (премиум-валюта). 0 — не продаётся за золото. Должна совпадать с Backend/products.json! */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "0"))
	int32 PricePremium = 0;

	/** Только за золото. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop")
	bool bPremiumOnly = false;

	/** Сколько штук даётся за одну покупку (черви — 20, крючки — 10). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Shop", meta = (ClampMin = "1"))
	int32 PurchaseQuantity = 1;

	/** Расходуется при каждой пойманной рыбе (натуральная наживка). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Usage")
	bool bConsumedOnCatch = false;

	/** Теряется при обрыве/зацепе (крючки, приманки). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Usage")
	bool bLostOnBreak = false;

	UFUNCTION(BlueprintPure, Category = "Item")
	bool CanBuyWithSoft() const { return !bPremiumOnly && PriceSoft > 0; }

	UFUNCTION(BlueprintPure, Category = "Item")
	bool CanBuyWithPremium() const { return PricePremium > 0; }
};

UCLASS(BlueprintType)
class FISHINGSIM_API URodData : public UTackleItemData
{
	GENERATED_BODY()

public:
	URodData() { Slot = ETackleSlot::Rod; }

	/** Способ ловли этим удилищем. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod")
	EBaitPresentation Presentation = EBaitPresentation::Float;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0.5"))
	float LengthM = 3.f;

	/** Тест (вес приманки/оснастки, г). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod")
	FFishValueRange CastWeightG = FFishValueRange(5.f, 20.f);

	/** Нагрузка, после которой удилище ломается (кгс). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0.5"))
	float MaxLoadKg = 4.f;

	/** Насколько гнётся кончик при максимальной нагрузке (м). Больше — мягче, лучше гасит рывки. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0.05"))
	float FlexAtMaxLoadM = 1.f;

	/** Демпфирование рывков (0 — жёсткий «кол», 1 — очень мягкий строй). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0", ClampMax = "1"))
	float ShockAbsorption = 0.6f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0.1"))
	float CastDistanceFactor = 1.f;

	/** Чувствительность: дольше видно поклёвку, выше шанс подсечки. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Rod", meta = (ClampMin = "0", ClampMax = "1"))
	float Sensitivity = 0.5f;

	/** Множитель дальности заброса от веса приманки (вне теста — хуже). */
	UFUNCTION(BlueprintPure, Category = "Rod")
	float GetCastWeightFactor(float LureWeightG) const
	{
		if (LureWeightG < CastWeightG.Min)
		{
			return FMath::Clamp(FMath::Sqrt(LureWeightG / FMath::Max(CastWeightG.Min, 0.1f)), 0.25f, 1.f);
		}
		if (LureWeightG > CastWeightG.Max)
		{
			return FMath::Clamp(1.f - (LureWeightG - CastWeightG.Max) / FMath::Max(CastWeightG.Max, 1.f), 0.3f, 1.f);
		}
		return 1.f;
	}
};

UCLASS(BlueprintType)
class FISHINGSIM_API UReelData : public UTackleItemData
{
	GENERATED_BODY()

public:
	UReelData() { Slot = ETackleSlot::Reel; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Reel", meta = (ClampMin = "0.1"))
	float MaxDragKg = 5.f;

	/** Сколько лески наматывается за оборот ручки (см). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Reel", meta = (ClampMin = "10"))
	float RetrievePerTurnCm = 70.f;

	/** Максимум оборотов ручки в секунду. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Reel", meta = (ClampMin = "0.2"))
	float MaxCrankRate = 2.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Reel", meta = (ClampMin = "10"))
	float LineCapacityM = 150.f;

	/** Плавность фрикциона: дешёвые катушки «страгиваются» рывком (0..1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Reel", meta = (ClampMin = "0", ClampMax = "1"))
	float DragSmoothness = 0.7f;

	UFUNCTION(BlueprintPure, Category = "Reel")
	float GetMaxRetrieveSpeedMps() const { return RetrievePerTurnCm / 100.f * MaxCrankRate; }
};

UCLASS(BlueprintType)
class FISHINGSIM_API ULineData : public UTackleItemData
{
	GENERATED_BODY()

public:
	ULineData() { Slot = ETackleSlot::Line; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line")
	ELineType LineType = ELineType::Mono;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0.04"))
	float DiameterMm = 0.25f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0.1"))
	float BreakStrengthKg = 5.f;

	/** Растяжение при разрывной нагрузке, % (моно ~20, флюр ~12, плетёнка ~3). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0.5"))
	float StretchPercent = 20.f;

	/** Заметность в воде (0..1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0", ClampMax = "1"))
	float Visibility = 0.5f;

	/** Стойкость к истиранию о камни/коряги (0..1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0", ClampMax = "1"))
	float AbrasionResistance = 0.5f;

	/** Прочность узла относительно лески (0.8–0.95). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Line", meta = (ClampMin = "0.3", ClampMax = "1"))
	float KnotStrength = 0.9f;
};

UCLASS(BlueprintType)
class FISHINGSIM_API UHookData : public UTackleItemData
{
	GENERATED_BODY()

public:
	UHookData()
	{
		Slot = ETackleSlot::Hook;
		bLostOnBreak = true;
		PurchaseQuantity = 10;
	}

	/** Номер крючка (межд. шкала: #1 — крупный, #18 — мелкий). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Hook", meta = (ClampMin = "1", ClampMax = "24"))
	int32 HookSize = 10;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Hook", meta = (ClampMin = "0", ClampMax = "1"))
	float Sharpness = 0.7f;

	/** Без бородки — бережно для рыбы, но чаще сходы. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Hook")
	bool bBarbless = false;

	/** С металлическим поводком: щука не перекусит, но мирная рыба пугается. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Hook")
	bool bWireLeader = false;
};

UCLASS(BlueprintType)
class FISHINGSIM_API UBaitData : public UTackleItemData
{
	GENERATED_BODY()

public:
	UBaitData() { Slot = ETackleSlot::Bait; }

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait")
	ELureType LureType = ELureType::Worm;

	/** С какими удилищами (способами ловли) можно использовать. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait")
	TArray<EBaitPresentation> AllowedPresentations;

	/** Вес приманки/оснастки (г) — влияет на дальность заброса. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait", meta = (ClampMin = "0.1"))
	float WeightG = 3.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait", meta = (ClampMin = "0"))
	float Attraction = 1.f;

	/** > 1 — отсекает мелочь (крупные приманки ловят крупную рыбу). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait", meta = (ClampMin = "0.2"))
	float SizeSelectivity = 1.f;

	/** Скорость погружения, м/с (отрицательная — всплывает). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait")
	float SinkRateMps = 0.3f;

	/** Рабочая глубина воблера при проводке, м. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait", meta = (ClampMin = "0"))
	float DiveDepthM = 0.f;

	/** Скорость проводки, при которой приманка «играет» лучше всего (м/с). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bait")
	FFishValueRange OptimalRetrieveSpeedMps = FFishValueRange(0.3f, 1.f);

	UFUNCTION(BlueprintPure, Category = "Bait")
	bool IsArtificial() const { return IsArtificialLure(LureType); }

	UFUNCTION(BlueprintPure, Category = "Bait")
	bool SupportsPresentation(EBaitPresentation InPresentation) const
	{
		return AllowedPresentations.Num() == 0 || AllowedPresentations.Contains(InPresentation);
	}
};

/** Собранная снасть. */
USTRUCT(BlueprintType)
struct FTackleLoadout
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loadout")
	TObjectPtr<URodData> Rod = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loadout")
	TObjectPtr<UReelData> Reel = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loadout")
	TObjectPtr<ULineData> Line = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loadout")
	TObjectPtr<UHookData> Hook = nullptr;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Loadout")
	TObjectPtr<UBaitData> Bait = nullptr;

	bool IsComplete() const
	{
		return Rod != nullptr && Reel != nullptr && Line != nullptr && Hook != nullptr && Bait != nullptr;
	}

	bool IsCompatible(FText& OutReason) const
	{
		if (!IsComplete())
		{
			OutReason = NSLOCTEXT("Fishing", "LoadoutIncomplete", "Снасть не собрана: нужны удилище, катушка, леска, крючок и наживка.");
			return false;
		}
		if (!Bait->SupportsPresentation(Rod->Presentation))
		{
			OutReason = NSLOCTEXT("Fishing", "LoadoutBaitMismatch", "Эта наживка не подходит к выбранному удилищу.");
			return false;
		}
		return true;
	}
};
