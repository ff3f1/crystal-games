#include "Fishing/FishingLureActor.h"
#include "World/FishingZone.h"
#include "World/FishingWorldSubsystem.h"
#include "Data/TackleData.h"
#include "Data/FishSpeciesData.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "UObject/ConstructorHelpers.h"

AFishingLureActor::AFishingLureActor()
{
	PrimaryActorTick.bCanEverTick = true;

	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));

	LureMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LureMesh"));
	LureMesh->SetupAttachment(Root);
	LureMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	LureMesh->SetRelativeScale3D(FVector(0.03f));

	FloatMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FloatMesh"));
	FloatMesh->SetupAttachment(Root);
	FloatMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	FloatMesh->SetRelativeScale3D(FVector(0.04f, 0.04f, 0.1f));
	FloatMesh->SetVisibility(false);

	FishMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("FishMesh"));
	FishMesh->SetupAttachment(Root);
	FishMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	FishMesh->SetVisibility(false);

	if (SphereMesh.Succeeded())
	{
		LureMesh->SetStaticMesh(SphereMesh.Object);
		FloatMesh->SetStaticMesh(SphereMesh.Object);
		PlaceholderFishMesh = SphereMesh.Object;
	}
}

void AFishingLureActor::Launch(const FVector& InVelocity, float InAirDragPerSec)
{
	Velocity = InVelocity;
	AirDragPerSec = FMath::Max(0.f, InAirDragPerSec);
	FlightTime = 0.f;
	Mode = ELureActorMode::Flying;
}

void AFishingLureActor::StopHorizontalMotion()
{
	// Леска кончилась — приманка падает почти отвесно
	Velocity.X *= 0.05f;
	Velocity.Y *= 0.05f;
}

void AFishingLureActor::SetupVisuals(const UBaitData* Bait, bool bShowFloat)
{
	FloatMesh->SetVisibility(bShowFloat);
	if (Bait && !Bait->Mesh.IsNull())
	{
		if (UStaticMesh* Mesh = Bait->Mesh.LoadSynchronous())
		{
			LureMesh->SetStaticMesh(Mesh);
			LureMesh->SetRelativeScale3D(FVector(1.f));
		}
	}
}

void AFishingLureActor::ShowHookedFish(const UFishSpeciesData* Species, float LengthCm)
{
	UStaticMesh* Mesh = nullptr;
	float Scale = 1.f;
	if (Species && !Species->Mesh.IsNull())
	{
		Mesh = Species->Mesh.LoadSynchronous();
		Scale = LengthCm / FMath::Max(1.f, Species->MeshLengthCm);
	}

	if (Mesh)
	{
		FishMesh->SetStaticMesh(Mesh);
		FishMesh->SetRelativeScale3D(FVector(Scale));
	}
	else if (PlaceholderFishMesh)
	{
		// Заглушка: вытянутая сфера длиной с рыбу (сфера в движке — 100 см)
		FishMesh->SetStaticMesh(PlaceholderFishMesh);
		FishMesh->SetRelativeScale3D(FVector(LengthCm / 100.f, LengthCm / 450.f, LengthCm / 300.f));
	}
	FishMesh->SetVisibility(true);
	FloatMesh->SetVisibility(false);
}

void AFishingLureActor::HideFish()
{
	FishMesh->SetVisibility(false);
}

void AFishingLureActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (Mode == ELureActorMode::Flying)
	{
		TickFlight(DeltaSeconds);
	}
}

void AFishingLureActor::TickFlight(float DeltaSeconds)
{
	UWorld* MyWorld = GetWorld();
	if (!MyWorld)
	{
		return;
	}

	FlightTime += DeltaSeconds;
	const FVector Start = GetActorLocation();
	Velocity.Z += MyWorld->GetGravityZ() * DeltaSeconds;
	Velocity *= FMath::Exp(-AirDragPerSec * DeltaSeconds);
	const FVector End = Start + Velocity * DeltaSeconds;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(LureFlight), false, this);
	if (AActor* MyOwner = GetOwner())
	{
		Params.AddIgnoredActor(MyOwner);
	}
	if (APawn* MyInstigator = GetInstigator())
	{
		Params.AddIgnoredActor(MyInstigator);
	}

	FHitResult Hit;
	const bool bHit = MyWorld->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
	const FVector TestPoint = bHit ? FVector(Hit.ImpactPoint) : End;

	const UFishingWorldSubsystem* WorldSub = MyWorld->GetSubsystem<UFishingWorldSubsystem>();
	AFishingZone* Zone = WorldSub ? WorldSub->FindZoneAt(TestPoint) : nullptr;
	if (Zone)
	{
		const double SurfaceZ = Zone->GetWaterSurfaceZ();
		// +30 см допуска: если меш воды сам блокирует трассировку
		if (TestPoint.Z <= SurfaceZ + 30.0)
		{
			FVector SplashPoint = TestPoint;
			if (Start.Z > SurfaceZ && End.Z < SurfaceZ)
			{
				const double Alpha = (Start.Z - SurfaceZ) / (Start.Z - End.Z);
				SplashPoint = FMath::Lerp(Start, End, Alpha);
			}
			SplashPoint.Z = SurfaceZ;

			SetActorLocation(SplashPoint);
			Velocity = FVector::ZeroVector;
			Mode = ELureActorMode::InWater;
			OnSplash(true);
			OnLanded.Broadcast(true, Zone);
			return;
		}
	}

	if (bHit || FlightTime > MaxFlightTime)
	{
		SetActorLocation(TestPoint);
		Velocity = FVector::ZeroVector;
		Mode = ELureActorMode::Inactive;
		OnSplash(false);
		OnLanded.Broadcast(false, nullptr);
		return;
	}

	SetActorLocation(End);
	if (!Velocity.IsNearlyZero())
	{
		SetActorRotation(Velocity.Rotation());
	}
}
