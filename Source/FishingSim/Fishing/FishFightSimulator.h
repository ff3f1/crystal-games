#pragma once

#include "CoreMinimal.h"
#include "Core/FishingTypes.h"

/** Параметры снасти для вываживания (собираются из FTackleLoadout). */
struct FFightTackle
{
	float DragKg = 2.f;
	float LineBreakKg = 5.f;
	float KnotStrength = 0.9f;
	float LineStretchFraction = 0.2f;
	float AbrasionResistance = 0.5f;
	float RodMaxLoadKg = 5.f;
	float RodFlexM = 1.f;
	float RodShockAbsorption = 0.6f;
	float RodLengthM = 3.f;
	float MaxRetrieveSpeedMps = 1.2f;
	float LineCapacityM = 150.f;
	float DragSmoothness = 0.7f;
	float HookSharpness = 0.7f;
	bool bBarbless = false;
	bool bWireLeader = false;
};

struct FFightInput
{
	float Reel01 = 0.f;		// скорость вращения катушки 0..1
	float RodLift01 = 0.f;	// подъём удилища (подкачка) 0..1
};

struct FFightEnvironment
{
	float BottomDepthM = 3.f;
	EBottomType Bottom = EBottomType::Mud;
	float LandingDistanceM = 2.f;
	float RodTipHeightM = 1.5f;
};

struct FFightStepResult
{
	float TensionKg = 0.f;
	bool bDragSlipping = false;
	bool bJumped = false;
	bool bLanded = false;
	EFishLoseReason LoseReason = EFishLoseReason::None;
};

/**
 * Физическая модель вываживания (единицы: метры, секунды, кгс).
 *
 * Леска + удилище — последовательные пружины: жёсткость удилища = MaxLoad / Flex, лески = Break / (Длина * Растяжение).
 * Плетёнка почти не тянется (рывки бьют по снасти), монофил гасит удары.
 * Если натяжение превышает фрикцион — шпуля отдаёт леску. Дешёвый фрикцион «страгивается» с рывком.
 * Рыба — тело с массой (плюс присоединённая масса воды), тягой, сопротивлением воды и выносливостью.
 * Слабина -> крючок выпадает, перегруз -> обрыв лески / поломка удилища, у дна — перетирание и коряги.
 */
class FISHINGSIM_API FFishFightSimulator
{
public:
	void Begin(FHookedFish& Fish, float InLineOutM, float InDistanceM, float InDepthM);

	FFightStepResult Step(FHookedFish& Fish, const FFightTackle& Tackle, const FFightInput& Input,
		const FFightEnvironment& Env, float DeltaTime);

	float LineOutM = 0.f;
	float TensionKg = 0.f;
	float LineWear = 0.f;	// 0..1 — потёртость лески
	float RodLiftM = 0.f;
	float FightTime = 0.f;

private:
	void UpdatePhase(FHookedFish& Fish, const FFightEnvironment& Env, float DeltaTime);
	static void GetPhaseParams(EFishFightPhase Phase, float& OutPullMul, float& OutSpeedMul);

	float PrevStretch = 0.f;
	float LineOverload = 0.f;
	float RodOverload = 0.f;
	float SlackTime = 0.f;
	float ShakeClock = 0.f;
	bool bWasSlipping = false;
};
