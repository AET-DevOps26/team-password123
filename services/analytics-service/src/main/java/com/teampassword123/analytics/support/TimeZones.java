package com.teampassword123.analytics.support;

import com.teampassword123.common.web.BadRequestException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Resolves the client's IANA timezone (the {@code tz} query param) into a {@link ZoneId}. The
 * streak "today" cursor, the insight window, and the day boundaries forwarded to meals-service are
 * all computed in this zone so they match the calendar the user sees. Absent {@code tz} falls back
 * to UTC (backwards compatible); a malformed value is a 400.
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
