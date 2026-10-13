package com.example.dunerealms;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Random;
import java.util.zip.GZIPInputStream;
import static org.junit.jupiter.api.Assertions.*;

class DiscordWebFeedTest {
    @Test void multipartMessagesRoundTripWithoutExceedingDiscordLimit() throws Exception {
        StringBuilder json = new StringBuilder("{\"offers\":\"");
        Random random = new Random(7);
        for (int i = 0; i < 15000; i++) json.append((char)('a' + random.nextInt(26)));
        json.append("\"}");
        var messages = DiscordWebFeed.encode(json.toString());
        assertTrue(messages.size() > 1);
        StringBuilder payload = new StringBuilder();
        String snapshotId = null;
        for (int i = 0; i < messages.size(); i++) {
            String message = messages.get(i);
            assertTrue(message.length() < 2000);
            String[] fields = message.split(" ", 4);
            assertEquals("DUNE_EXCHANGE", fields[0]);
            if (snapshotId == null) snapshotId = fields[1];
            assertEquals(snapshotId, fields[1]);
            assertEquals((i + 1) + "/" + messages.size(), fields[2]);
            payload.append(fields[3]);
        }
        try (var gzip = new GZIPInputStream(new ByteArrayInputStream(Base64.getDecoder().decode(payload.toString())))) {
            assertEquals(json.toString(), new String(gzip.readAllBytes(), StandardCharsets.UTF_8));
        }
    }
    @Test void oversizedPublicationIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> DiscordWebFeed.encode("x".repeat(2_000_001)));
    }
}
