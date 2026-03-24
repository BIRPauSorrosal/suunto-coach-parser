def ms_to_minkm(speed_ms: float) -> float:
    """Converteix velocitat (m/s) a ritme (min/km). Exemple: 2.08 m/s -> 8.01 min/km"""
    if not speed_ms or speed_ms <= 0:
        return 0.0
    pace_decimal = 1000 / (speed_ms * 60)
    return round(pace_decimal, 2)


def hz_to_spm(cadence_hz: float) -> int:
    """Converteix cadència (Hz d'un peu) a passes per minut globals (SPM)."""
    if not cadence_hz or cadence_hz <= 0:
        return 0
    return int(round(cadence_hz * 60 * 2))


def seconds_to_hours(seconds: float) -> float:
    """Converteix segons a hores amb 1 decimal."""
    if not seconds or seconds <= 0:
        return 0.0
    return round(seconds / 3600, 1)


def seconds_to_minutes(seconds: float) -> float:
    """Converteix segons a minuts amb 1 decimal."""
    if not seconds or seconds <= 0:
        return 0.0
    return round(seconds / 60, 1)
