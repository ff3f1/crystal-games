#pragma once

#include "CoreMinimal.h"
#include "FishingTypes.generated.h"

class UFishSpeciesData;

/** Состояние рыбалки (машина состояний UFishingComponent). */
UENUM(BlueprintType)
enum class EFishingState : uint8
{
	Idle,			// снасть собрана, можно забрасывать
	ChargingCast,	// игрок держит кнопку заброса (набор силы)
	LureFlying,		// приманка летит
	InWater,		// снасть в воде: ожидание / проводка
	Bite,			// поклёвка — нужно подсечь
	Fighting,		// вываживание
	Landed,			// рыба в подсачеке — в садок или отпустить
	Lost			// сход / обрыв (короткая пауза, затем Idle)
};

/** Причина потери рыбы / снасти. */
UENUM(BlueprintType)
enum class EFishLoseReason : uint8
{
	None,
	LineBroke,		// обрыв лески
	RodBroke,		// сломано удилище
	HookSpat,		// сход с крючка
	Spooled,		// кончилась леска на шпуле
	BiteOff,		// перекус (щука без поводка)
	Snagged,		// зацеп / рыба завела в коряги
	MissedStrike,	// пустая подсечка
	BaitStolen,		// рыба объела наживку
	CastFailed		// заброс мимо воды
};

UENUM(BlueprintType)
enum class EBottomType : uint8
{
	Mud,
	Sand,
	Rock,
	Weeds,
	Snags
};

UENUM(BlueprintType)
enum class ELineType : uint8
{
	Mono,
	Fluoro,
	Braid
};

/** Тип наживки/приманки. Всё, что начиная со Spinner, — искусственные приманки. */
UENUM(BlueprintType)
enum class ELureType : uint8
{
	Worm,
	Maggot,
	Bread,
	Corn,
	Boilie,
	LiveBait,
	Spinner,
	Spoon,
	Wobbler,
	SoftPlastic,
	Topwater
};

FORCEINLINE bool IsArtificialLure(ELureType Type)
{
	return Type >= ELureType::Spinner;
}

/** Способ ловли — задаётся удилищем. */
UENUM(BlueprintType)
enum class EBaitPresentation : uint8
{
	Float,		// поплавочная снасть
	Bottom,		// донка / фидер
	Spinning	// спиннинг (активная проводка)
};

UENUM(BlueprintType)
enum class ETackleSlot : uint8
{
	Rod,
	Reel,
	Line,
	Hook,
	Bait
};

UENUM(BlueprintType)
enum class EFishingWeather : uint8
{
	Clear,
	Cloudy,
	Overcast,
	Rain,
	Storm,
	Fog
};

UENUM(BlueprintType)
enum class EFishFightPhase : uint8
{
	Run,		// рывок, уход от рыбака
	Hold,		// упирается, идёт ко дну / в укрытие
	HeadShake,	// трясёт головой
	Jump,		// свечка
	Tired		// устала, подходит к берегу
};

UENUM(BlueprintType)
enum class EStorePurchaseResult : uint8
{
	Success,
	NotEnoughCurrency,
	LevelTooLow,
	PremiumOnly,
	NotForSale,
	UnknownItem,
	AlreadyOwned,
	Pending,
	Failed
};

/** Диапазон значений [Min, Max]. */
USTRUCT(BlueprintType)
struct FFishValueRange
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Range")
	float Min = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Range")
	float Max = 1.f;

	FFishValueRange() = default;
	FFishValueRange(float InMin, float InMax) : Min(InMin), Max(InMax) {}

	float Lerp(float Alpha) const { return FMath::Lerp(Min, Max, Alpha); }
	bool Contains(float Value) const { return Value >= Min && Value <= Max; }

	/** 0 внутри диапазона, иначе расстояние до ближайшей границы. */
	float DistanceOutside(float Value) const
	{
		return Value < Min ? (Min - Value) : (Value > Max ? (Value - Max) : 0.f);
	}
};

/** Окно кормёжки: в эти часы активность вида равна Multiplier (с плавными краями). */
USTRUCT(BlueprintType)
struct FFeedingWindow
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Feeding", meta = (ClampMin = "0", ClampMax = "24"))
	float StartHour = 5.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Feeding", meta = (ClampMin = "0", ClampMax = "24"))
	float EndHour = 9.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Feeding", meta = (ClampMin = "0"))
	float Multiplier = 1.5f;

	/** 0..1 — насколько час попадает в окно (окна могут переходить через полночь). */
	float GetWeight(float Hour) const
	{
		constexpr float Fade = 0.5f; // полчаса на «разгон» клёва
		const float Len = FMath::Fmod(EndHour - StartHour + 24.f, 24.f);
		const float Pos = FMath::Fmod(Hour - StartHour + 48.f, 24.f);

		if (Pos <= Len)
		{
			const float Inside = FMath::Min(Pos, Len - Pos);
			return FMath::Clamp(0.5f + 0.5f * Inside / Fade, 0.f, 1.f);
		}

		const float Outside = FMath::Min(Pos - Len, 24.f - Pos);
		return FMath::Clamp(0.5f - 0.5f * Outside / Fade, 0.f, 1.f);
	}
};

/** Запись об улове. */
USTRUCT(BlueprintType)
struct FCatchRecord
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	FName SpeciesId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	float WeightKg = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	float LengthCm = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	bool bTrophy = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	FName BaitId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	FName RodId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	FString ZoneName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	float GameHour = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	FDateTime CaughtAt;

	/** Цена при продаже (серебро). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	int32 SoftValue = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Catch")
	int32 Xp = 0;
};

/** Состояние рыбы на крючке (обновляется симуляцией вываживания). */
USTRUCT(BlueprintType)
struct FHookedFish
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	TObjectPtr<UFishSpeciesData> Species = nullptr;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float WeightKg = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float LengthCm = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	bool bTrophy = false;

	/** 0..1 — силы рыбы. */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float Stamina = 1.f;

	/** 0..1 — насколько надёжно сидит крючок. */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float HookHold = 1.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float DepthM = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float TargetDepthM = 0.f;

	/** Горизонтальная дистанция от кончика удилища, м. */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float DistanceM = 0.f;

	/** Мировой yaw направления «кончик удилища -> рыба». */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float BearingDeg = 0.f;

	/** Курс рыбы относительно направления «от рыбака» (0 = прямо от рыбака, 180 = на рыбака). */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float SwimAngleDeg = 0.f;

	/** Радиальная скорость, м/с (+ = от рыбака). */
	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float RadialSpeed = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	EFishFightPhase Phase = EFishFightPhase::Run;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	float PhaseTimer = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fish")
	bool bJumpDone = false;
};
