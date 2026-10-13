package com.example.dunerealms;

import org.bukkit.*;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import java.io.*;
import java.util.*;

/** Durable fifteen-minute embargo; BungeeCord Message ALL reaches every backend. */
final class ArrakisAnnouncements {
    private final DuneCore plugin;
    private final File file;
    private final YamlConfiguration state;
    private final Set<String> pending = new HashSet<>();

    ArrakisAnnouncements(DuneCore plugin) {
        this.plugin = plugin;
        file = new File(plugin.getDataFolder(), "arrakis-announcements.yml");
        state = YamlConfiguration.loadConfiguration(file);
        for (String key : state.getKeys(false)) if (!state.getBoolean(key + ".sent")) pending.add(key);
        plugin.getServer().getMessenger().registerOutgoingPluginChannel(plugin, "BungeeCord");
        Bukkit.getScheduler().runTaskTimer(plugin, this::deliver, 20L, 20L);
    }

    void announce(String kind, Location location, String identity) {
        if (location.getWorld() == null || !location.getWorld().getName().equalsIgnoreCase("arrakis")) return;
        String key = UUID.nameUUIDFromBytes(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
        if (state.contains(key)) return;
        String coordinates = "Arrakis [X " + location.getBlockX() + ", Y " + location.getBlockY() + ", Z " + location.getBlockZ() + "]";
        String sighting = kind.equals("sandworm") ? "Shai-Hulud stirs beneath the sands at " : "The desert reveals a melange spice bloom at ";
        String message = sighting + coordinates + ".";
        state.set(key + ".message", ChatColor.GOLD + "[Spacing Guild] Our Navigators have detected: " + message + " The Guild now informs all worlds. The spice must flow!");
        state.set(key + ".due", System.currentTimeMillis() + 15L * 60L * 1000L);
        pending.add(key);
        save();
        Bukkit.broadcastMessage(ChatColor.GOLD + "[Arrakis] " + message + " You have 15 minutes before the Spacing Guild notices and informs all other servers.");
    }

    private void deliver() {
        for (String key : new ArrayList<>(pending)) {
            if (state.getBoolean(key + ".sent") || state.getLong(key + ".due") > System.currentTimeMillis()) continue;
            String message = state.getString(key + ".message", "");
            if (plugin.getConfig().getBoolean("network.enabled", true)) {
                Player carrier = Bukkit.getOnlinePlayers().stream().findFirst().orElse(null);
                if (carrier == null) continue; // Plugin messaging needs a player connection; keep pending.
                try {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    DataOutputStream out = new DataOutputStream(bytes);
                    out.writeUTF("Message"); out.writeUTF("ALL"); out.writeUTF(message);
                    carrier.sendPluginMessage(plugin, "BungeeCord", bytes.toByteArray());
                } catch (IOException ex) { plugin.getLogger().warning("Guild announcement failed: " + ex.getMessage()); continue; }
            } else Bukkit.broadcastMessage(message);
            state.set(key + ".sent", true);
            pending.remove(key);
            save();
        }
    }

    private void save() {
        try { state.save(file); }
        catch (IOException ex) { plugin.getLogger().severe("Cannot save Guild announcements: " + ex.getMessage()); }
    }
}
