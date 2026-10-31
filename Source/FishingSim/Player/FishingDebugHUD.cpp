#include "Player/FishingDebugHUD.h"
#include "Fishing/FishingComponent.h"
#include "Economy/FishingProfileSubsystem.h"
#include "World/FishingWorldSubsystem.h"
#include "World/FishingZone.h"
#include "Data/FishingCatalog.h"
#include "Data/FishSpeciesData.h"
#include "Data/TackleData.h"
#include "Engine/Canvas.h"
#include "GameFramework/Pawn.h"

namespace
{
	FString StateToString(EFishingState State)
	{
		switch (State)
		{
		case EFishingState::Idle:			return TEXT("Готов к забросу");
		case EFishingState::ChargingCast:	return TEXT("Замах...");
		case EFishingState::LureFlying:		return TEXT("Заброс");
		case EFishingState::InWater:		return TEXT("Снасть в воде");
		case EFishingState::Bite:			return TEXT("ПОКЛЁВКА! Подсекай (Пробел)");
		case EFishingState::Fighting:		return TEXT("Вываживание");
		case EFishingState::Landed:			return TEXT("Рыба в подсачеке");
		case EFishingState::Lost:			return TEXT("Сход");
		default:							return FString();
		}
	}

	FString ItemName(const UTackleItemData* Item)
	{
		return Item ? Item->DisplayName.ToString() : TEXT("— нет —");
	}
}

void AFishingDebugHUD::DrawHUD()
{
	Super::DrawHUD();
	if (!Canvas)
	{
		return;
	}

	const APawn* Pawn = GetOwningPawn();
	const UFishingComponent* FC = Pawn ? Pawn->FindComponentByClass<UFishingComponent>() : nullptr;
	const UFishingProfileSubsystem* Profile = UFishingProfileSubsystem::Get(this);
	const UFishingWorldSubsystem* WorldSub = UFishingWorldSubsystem::Get(this);

	const float SizeX = Canvas->ClipX;
	const float SizeY = Canvas->ClipY;
	const FLinearColor White = FLinearColor::White;
	const FLinearColor Gray(0.7f, 0.7f, 0.7f);
	const FLinearColor Gold(1.f, 0.8f, 0.2f);
	const FLinearColor Panel(0.f, 0.f, 0.f, 0.45f);

	float Y = 20.f;
	auto Line = [&](const FString& Text, const FLinearColor& Color, float X = 30.f)
	{
		DrawText(Text, Color, X, Y, nullptr, 1.1f);
		Y += 20.f;
	};

	// ---------------- Левая панель: мир и профиль ----------------
	DrawRect(Panel, 15.f, 12.f, 420.f, 230.f);
	if (WorldSub)
	{
		Line(FString::Printf(TEXT("%s   День %d   %s"),
			*WorldSub->GetTimeText().ToString(), WorldSub->DayIndex + 1,
			*UFishingWorldSubsystem::GetWeatherText(WorldSub->Weather).ToString()), White);
		Line(FString::Printf(TEXT("Воздух %.0f°C   Вода %.1f°C   Давление %.0f гПа (%+.1f/ч)   Ветер %.0f м/с"),
			WorldSub->AirTempC, WorldSub->GetWaterTemperatureAt(0.5f), WorldSub->PressureHpa,
			WorldSub->PressureTrendHpaPerHour, WorldSub->WindSpeedMps), Gray);
	}
	if (Profile)
	{
		Line(FString::Printf(TEXT("Уровень %d  (%d / %d XP)"), Profile->GetLevel(), Profile->GetXp(),
			UFishingProfileSubsystem::GetXpRequiredForLevel(Profile->GetLevel())), White);
		Line(FString::Printf(TEXT("Серебро: %lld    Золото: %lld%s"), Profile->GetSoftCurrency(), Profile->GetPremiumCurrency(),
			Profile->IsPremiumAccountActive() ? TEXT("    [ПРЕМИУМ]") : TEXT("")), Gold);
		Line(FString::Printf(TEXT("В садке: %d рыб    Всего поймано: %d"), Profile->GetKeepnet().Num(), Profile->GetTotalCatches()), Gray);
	}

	if (!FC)
	{
		return;
	}

	const FTackleLoadout Loadout = FC->GetLoadout();
	Y += 6.f;
	Line(FString::Printf(TEXT("[1] %s"), *ItemName(Loadout.Rod)), Gray);
	Line(FString::Printf(TEXT("[2] %s   [3] %s"), *ItemName(Loadout.Reel), *ItemName(Loadout.Line)), Gray);
	Line(FString::Printf(TEXT("[4] %s   [5] %s (%d шт.)"), *ItemName(Loadout.Hook), *ItemName(Loadout.Bait),
		(Profile && Loadout.Bait) ? Profile->GetItemCount(Loadout.Bait->ItemId) : 0), Gray);

	// ---------------- Центр: состояние ----------------
	const EFishingState State = FC->GetFishingState();
	const FString StateText = StateToString(State);
	const FLinearColor StateColor = State == EFishingState::Bite ? FLinearColor(1.f, 0.3f, 0.2f) : White;
	DrawText(StateText, StateColor, SizeX * 0.5f - 120.f, SizeY * 0.12f, nullptr, 1.6f);

	// Сообщение
	if (FC->GetLastMessageAge() < 4.f)
	{
		DrawText(FC->GetLastMessage().ToString(), Gold, SizeX * 0.5f - 200.f, SizeY * 0.17f, nullptr, 1.3f);
	}

	// Сила заброса
	if (State == EFishingState::ChargingCast)
	{
		const float W = 300.f;
		const float X0 = SizeX * 0.5f - W * 0.5f;
		const float Y0 = SizeY * 0.75f;
		DrawRect(Panel, X0 - 2.f, Y0 - 2.f, W + 4.f, 18.f);
		DrawRect(FLinearColor(0.3f, 0.7f, 1.f), X0, Y0, W * FC->GetCastCharge(), 14.f);
	}

	// ---------------- Низ: шкала натяжения ----------------
	if (State == EFishingState::InWater || State == EFishingState::Bite || State == EFishingState::Fighting)
	{
		const float W = 500.f;
		const float X0 = SizeX * 0.5f - W * 0.5f;
		const float Y0 = SizeY - 110.f;
		const float T01 = FMath::Clamp(FC->GetTension01(), 0.f, 1.f);
		const FLinearColor BarColor = FLinearColor::LerpUsingHSV(FLinearColor::Green, FLinearColor::Red, T01);

		DrawRect(Panel, X0 - 10.f, Y0 - 34.f, W + 20.f, 100.f);
		DrawRect(FLinearColor(0.15f, 0.15f, 0.15f), X0, Y0, W, 20.f);
		DrawRect(BarColor, X0, Y0, W * T01, 20.f);
		// Отметка фрикциона
		const float DragX = X0 + W * FMath::Clamp(FC->GetDragMark01(), 0.f, 1.f);
		DrawRect(FLinearColor::Yellow, DragX - 1.5f, Y0 - 6.f, 3.f, 32.f);

		DrawText(FString::Printf(TEXT("Натяжение %.2f кг / предел %.2f кг   Фрикцион %.1f кг%s"),
			FC->GetTensionKg(), FC->GetWeakestLinkKg(), FC->GetDragKg(), FC->IsDragSlipping() ? TEXT("  ТРЕЩИТ!") : TEXT("")),
			White, X0, Y0 - 28.f, nullptr, 1.f);

		const AFishingZone* Zone = FC->GetCurrentZone();
		DrawText(FString::Printf(TEXT("Леска %.1f м   Приманка %.1f м / дно %.1f м   Скорость %.2f м/с   Клёв ~%.1f/мин   %s"),
			FC->GetLineOutM(), FC->GetLureDepthM(), FC->GetBottomDepthM(), FC->GetLureSpeedMps(),
			FC->GetBiteRatePerMinute(), Zone ? *Zone->ZoneName.ToString() : TEXT("")),
			Gray, X0, Y0 + 28.f, nullptr, 1.f);

		if (FC->GetLineWear01() > 0.05f)
		{
			DrawText(FString::Printf(TEXT("Леска перетёрта на %.0f%%"), FC->GetLineWear01() * 100.f),
				FLinearColor(1.f, 0.5f, 0.2f), X0, Y0 + 46.f, nullptr, 1.f);
		}

		if (State == EFishingState::Fighting && bShowFishDebug)
		{
			const FHookedFish Fish = FC->GetHookedFish();
			DrawText(FString::Printf(TEXT("[DEBUG] %s %.2f кг  силы %.0f%%  крючок %.0f%%  дист %.1f м  глуб %.1f м"),
				Fish.Species ? *Fish.Species->DisplayName.ToString() : TEXT("?"), Fish.WeightKg,
				Fish.Stamina * 100.f, Fish.HookHold * 100.f, Fish.DistanceM, Fish.DepthM),
				FLinearColor(0.6f, 0.9f, 1.f), X0, Y0 - 50.f, nullptr, 1.f);
		}
	}
	else if (State == EFishingState::Idle && Loadout.Rod && Loadout.Rod->Presentation == EBaitPresentation::Float)
	{
		DrawText(FString::Printf(TEXT("Глубина спуска поплавка: %.2f м (Z/X)"), FC->GetFloatDepthM()),
			Gray, SizeX * 0.5f - 150.f, SizeY - 60.f, nullptr, 1.f);
	}

	// ---------------- Карточка улова ----------------
	if (State == EFishingState::Landed)
	{
		const FCatchRecord Catch = FC->GetPendingCatch();
		const UFishSpeciesData* Species = (Profile && Profile->GetCatalog()) ? Profile->GetCatalog()->FindSpecies(Catch.SpeciesId) : nullptr;
		const float W = 460.f;
		const float X0 = SizeX * 0.5f - W * 0.5f;
		const float Y0 = SizeY * 0.3f;
		DrawRect(FLinearColor(0.f, 0.f, 0.f, 0.7f), X0, Y0, W, 170.f);
		DrawText(Species ? Species->DisplayName.ToString() : Catch.SpeciesId.ToString(), Gold, X0 + 20.f, Y0 + 15.f, nullptr, 1.8f);
		if (Catch.bTrophy)
		{
			DrawText(TEXT("ТРОФЕЙ!"), FLinearColor(1.f, 0.4f, 0.1f), X0 + W - 130.f, Y0 + 18.f, nullptr, 1.5f);
		}
		DrawText(FString::Printf(TEXT("Вес: %.3f кг    Длина: %.1f см"), Catch.WeightKg, Catch.LengthCm), White, X0 + 20.f, Y0 + 60.f, nullptr, 1.2f);
		DrawText(FString::Printf(TEXT("Цена: %d серебра    Опыт: %d"), Catch.SoftValue, Catch.Xp), Gray, X0 + 20.f, Y0 + 88.f, nullptr, 1.1f);
		DrawText(TEXT("F — в садок      G — отпустить (+25% опыта)"), White, X0 + 20.f, Y0 + 125.f, nullptr, 1.1f);
	}

	// ---------------- Подсказка по управлению ----------------
	if (bShowControlsHelp)
	{
		const float X = SizeX - 360.f;
		float HelpY = 20.f;
		DrawRect(Panel, X - 10.f, 12.f, 350.f, 250.f);
		const TCHAR* Help[] = {
			TEXT("ЛКМ держать/отпустить — заброс"),
			TEXT("ЛКМ держать — подмотка"),
			TEXT("ПКМ — поднять удилище (подкачка)"),
			TEXT("Пробел — подсечка / рывок приманкой"),
			TEXT("Колесо — фрикцион,  Q/E — скорость"),
			TEXT("Z/X — глубина поплавка"),
			TEXT("R — смотать снасть"),
			TEXT("F/G — в садок / отпустить"),
			TEXT("K — продать садок"),
			TEXT("1-5 — сменить снасть (на берегу)"),
		};
		for (const TCHAR* HelpLine : Help)
		{
			DrawText(HelpLine, Gray, X, HelpY, nullptr, 1.f);
			HelpY += 23.f;
		}
	}
}
