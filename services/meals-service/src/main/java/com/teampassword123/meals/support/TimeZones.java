package com.teampassword123.meals.support;

import com.teampassword123.meals.exception.BadRequestException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Resolves the client's IANA timezone (the {@code tz} query param) into a {@link ZoneId}. Day
 * boundaries are bucketed by this zone so a meal logged just after midnight local time lands on the
 * local calendar day, not the UTC one. Absent {@code tz} falls back to UTC (backwards compatible);
 * a malformed value is a 400 rather than a silent wrong-day fallback.
 */
public final class TimeZones {

  private TimeZones() {}

  public static ZoneId resolve(String tz) {
    if (tz == null || tz.isBlank()) {
      return ZoneOffset.UTC;
    }
    try {
      return ZoneId.of(tz.trim());
    } catch (DateTimeException e) {
      throw new BadRequestException("Invalid timezone: " + tz);
    }
  }
}
