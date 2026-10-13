package com.example.dunerealms;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.server.BroadcastMessageEvent;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.zip.GZIPOutputStream;

/** Opt-in publication of public notifications and read-only market snapshots via DiscordSRV. */
final class DiscordWebFeed implements Listener {
    private final DuneCore plugin;
    private final Gson gson = new GsonBuilder().serializeNulls().create();
    DiscordWebFeed(DuneCore plugin) { this.plugin = plugin; }
    void start() {
        Bukkit.getPluginManager().registerEvents(this, plugin);
        Bukkit.getScheduler().runTaskTimer(plugin, this::exchange, 200L, 1200L);
    }
    boolean enabled() { return plugin.getConfig().getBoolean("website.discord.enabled", false)
        && Bukkit.getPluginManager().isPluginEnabled("DiscordSRV"); }
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void broadcast(BroadcastMessageEvent event) {
        if (!enabled()) return;
        String message = event.getMessage();
        if (event.isAsynchronous()) Bukkit.getScheduler().runTask(plugin, () -> news(message));
        else news(message);
    }
    void news(String message) {
        if (!enabled()) return;
        String clean = ChatColor.stripColor(message).replace('\n', ' ').replace('\r', ' ');
        if (clean.isBlank()) return;
        String planet = plugin.getConfig().getString("network.local-planet", "arrakis");
        send("news-channel-id", "[" + planet + "] " + clean.substring(0, Math.min(1600, clean.length())));
    }
    private void exchange() {
        if (!enabled()) return;
        // Only Arrakis publishes the market, avoiding independent backend snapshots overwriting it.
        if (!plugin.getConfig().getString("network.local-planet", "arrakis").equalsIgnoreCase("arrakis")) return;
        try {
            for (String part : encode(gson.toJson(plugin.websiteExchangeSnapshot()))) send("exchange-channel-id", part);
        } catch (IOException | IllegalArgumentException ex) {
            plugin.getLogger().warning("Website exchange snapshot skipped: " + ex.getMessage());
        }
    }
    private void send(String key, String content) {
        String channel = plugin.getConfig().getString("website.discord." + key, "");
        if (!channel.matches("[0-9]{17,22}")) return;
        Bukkit.dispatchCommand(Bukkit.getConsoleSender(), "discordsrv broadcast #" + channel + " " + content);
    }
    static List<String> encode(String json) throws IOException {
        byte[] raw = json.getBytes(StandardCharsets.UTF_8);
        if (raw.length > 2_000_000) throw new IllegalArgumentException("Market exceeds the supported 2 MB snapshot limit");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(output)) { gzip.write(raw); }
        String payload = Base64.getEncoder().encodeToString(output.toByteArray());
        int parts = (payload.length() + 1699) / 1700;
        if (parts > 90) throw new IllegalArgumentException("Market exceeds 90 Discord snapshot parts");
        String id = UUID.randomUUID().toString();
        List<String> messages = new ArrayList<>();
        for (int i = 0; i < parts; i++) messages.add("DUNE_EXCHANGE " + id + " " + (i + 1) + "/" + parts + " "
            + payload.substring(i * 1700, Math.min((i + 1) * 1700, payload.length())));
        return messages;
    }
}
