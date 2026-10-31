#include "World/FishingZone.h"
#include "World/FishingWorldSubsystem.h"
#include "Components/BoxComponent.h"
#include "Engine/World.h"

AFishingZone::AFishingZone()
{
	PrimaryActorTick.bCanEverTick = false;

	WaterBox = CreateDefaultSubobject<UBoxComponent>(TEXT("WaterBox"));
	RootComponent = WaterBox;
	WaterBox->SetBoxExtent(FVector(2000.f, 2000.f, 300.f));
	WaterBox->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	WaterBox->SetGenerateOverlapEvents(false);
	WaterBox->ShapeColor = FColor(30, 144, 255);
	WaterBox->SetLineThickness(4.f);

	ZoneName = NSLOCTEXT("Fishing", "DefaultZoneName", "Водоём");
}

void AFishingZone::BeginPlay()
{
	Super::BeginPlay();
	if (UFishingWorldSubsystem* WorldSub = UFishingWorldSubsystem::Get(this))
	{
		WorldSub->RegisterZone(this);
	}
}

void AFishingZone::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UFishingWorldSubsystem* WorldSub = UFishingWorldSubsystem::Get(this))
	{
		WorldSub->UnregisterZone(this);
	}
	Super::EndPlay(EndPlayReason);
}

float AFishingZone::GetWaterSurfaceZ() const
{
	return static_cast<float>(WaterBox->GetComponentLocation().Z + WaterBox->GetScaledBoxExtent().Z);
}

bool AFishingZone::ContainsXY(const FVector& WorldLocation) const
{
	const FVector Local = WaterBox->GetComponentTransform().InverseTransformPosition(WorldLocation);
	const FVector Extent = WaterBox->GetUnscaledBoxExtent();
	return FMath::Abs(Local.X) <= Extent.X && FMath::Abs(Local.Y) <= Extent.Y;
}

float AFishingZone::GetDepthAt(const FVector& WorldLocation) const
{
	const UWorld* World = GetWorld();
	if (!World)
	{
		return FallbackDepthM;
	}

	const float SurfaceZ = GetWaterSurfaceZ();
	// Стартуем чуть ниже поверхности, чтобы не попасть в меш водной глади
	const FVector Start(WorldLocation.X, WorldLocation.Y, SurfaceZ - 5.f);
	const FVector End(WorldLocation.X, WorldLocation.Y, SurfaceZ - MaxDepthM * 100.f);

	FCollisionQueryParams Params(SCENE_QUERY_STAT(FishingBottomTrace), false, this);
	for (AActor* Ignored : ActorsIgnoredByBottomTrace)
	{
		if (Ignored)
		{
			Params.AddIgnoredActor(Ignored);
		}
	}

	// Ищем только статику (ландшафт, камни, коряги), чтобы не зацепить персонажа
	FHitResult Hit;
	if (World->LineTraceSingleByObjectType(Hit, Start, End, FCollisionObjectQueryParams(ECC_WorldStatic), Params))
	{
		return FMath::Max(0.05f, (SurfaceZ - static_cast<float>(Hit.ImpactPoint.Z)) / 100.f);
	}
	return FallbackDepthM;
}

float AFishingZone::GetCurrentPressure() const
{
	const UWorld* World = GetWorld();
	const float Now = World ? World->GetTimeSeconds() : 0.f;
	const float Minutes = FMath::Max(0.f, Now - PressureTimestamp) / 60.f;
	return FMath::Max(0.f, StoredPressure - Minutes * PressureRecoveryPerMinute);
}

void AFishingZone::AddFishingPressure(float Amount)
{
	const UWorld* World = GetWorld();
	StoredPressure = FMath::Clamp(GetCurrentPressure() + Amount, 0.f, 1.f);
	PressureTimestamp = World ? World->GetTimeSeconds() : 0.f;
}

float AFishingZone::GetPressureFactor() const
{
	return 1.f - 0.7f * GetCurrentPressure();
}
