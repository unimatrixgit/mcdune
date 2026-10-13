package com.example.duneess;

import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.economy.EconomyResponse;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DuneEss's Solaris ledger and Vault economy service. */
@SuppressWarnings("deprecation")
final class DuneEconomy implements Economy {
    private final DuneEss plugin;
    private final Map<UUID, Double> balances = new HashMap<>();
    private final File file;
    private final YamlConfiguration data;
    private final boolean allowNegative;
    private final String singular, plural;
    private String jdbcUrl = "", dbUser = "", dbPassword = "";
    private boolean databaseEnabled;

    DuneEconomy(DuneEss plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "balances.yml");
        this.data = YamlConfiguration.loadConfiguration(file);
        this.allowNegative = plugin.getConfig().getBoolean("currency.allow-negative-balances", true);
        this.singular = plugin.getConfig().getString("currency.singular", "Solaris");
        this.plural = plugin.getConfig().getString("currency.plural", "Solaris");
        loadDatabaseSettings();
        loadBalances();
    }

    private void loadDatabaseSettings() {
        if (!plugin.getConfig().getBoolean("database.use-core-database", true)) return;
        File coreConfig = new File(plugin.getDataFolder().getParentFile(), "DuneCore/config.yml");
        if (!coreConfig.isFile()) return;
        YamlConfiguration core = YamlConfiguration.loadConfiguration(coreConfig);
        if (!core.getBoolean("database.enabled", false)) return;
        jdbcUrl = core.getString("database.jdbc-url", "");
        dbUser = core.getString("database.username", "");
        dbPassword = core.getString("database.password", "");
        databaseEnabled = !jdbcUrl.isBlank();
    }

    private Connection connect() throws SQLException {
        return DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
    }

    private void loadBalances() {
        try { file.getParentFile().mkdirs(); } catch (Exception ignored) { }
        for (String key : data.getKeys(false)) {
            try { balances.put(UUID.fromString(key), money(data.getDouble(key))); }
            catch (IllegalArgumentException ignored) { }
        }
        importLegacyFile();
        if (databaseEnabled) {
            try (Connection c = connect(); Statement s = c.createStatement()) {
                s.executeUpdate("CREATE TABLE IF NOT EXISTS dune_economy_balances (uuid UUID PRIMARY KEY, balance NUMERIC(20,2) NOT NULL DEFAULT 0)");
                boolean empty;
                try (ResultSet rows = s.executeQuery("SELECT NOT EXISTS (SELECT 1 FROM dune_economy_balances)")) {
                    empty = rows.next() && rows.getBoolean(1);
                }
                if (empty) {
                    importLegacyDatabase(c);
                    importLocalBalances(c);
                }
                try (ResultSet rows = s.executeQuery("SELECT uuid,balance FROM dune_economy_balances")) {
                    while (rows.next()) balances.put(rows.getObject(1, UUID.class), money(rows.getDouble(2)));
                }
            } catch (SQLException ex) {
                databaseEnabled = false;
                plugin.getLogger().severe("Could not open the shared Solaris database; using the migrated local ledger: " + ex.getMessage());
            }
        }
        saveLocal();
    }

    private void importLegacyFile() {
        if (!balances.isEmpty()) return;
        File old = new File(plugin.getDataFolder().getParentFile(), "DuneCore/players.yml");
        if (!old.isFile()) old = new File(plugin.getDataFolder().getParentFile(), "DuneRealms/players.yml");
        if (!old.isFile()) return;
        YamlConfiguration legacy = YamlConfiguration.loadConfiguration(old);
        for (String key : legacy.getKeys(false)) try {
            UUID id = UUID.fromString(key);
            if (legacy.contains(key + ".solaris")) balances.put(id, money(legacy.getDouble(key + ".solaris")));
        } catch (IllegalArgumentException ignored) { }
        if (!balances.isEmpty()) plugin.getLogger().info("Imported " + balances.size() + " Solaris balances from the previous Dune data file.");
    }

    private void importLegacyDatabase(Connection c) {
        try (Statement s = c.createStatement(); ResultSet rows = s.executeQuery("SELECT uuid,solaris FROM dune_players WHERE solaris<>0")) {
            try (PreparedStatement insert = c.prepareStatement("INSERT INTO dune_economy_balances(uuid,balance) VALUES (?,?) ON CONFLICT(uuid) DO NOTHING")) {
                while (rows.next()) {
                    insert.setObject(1, rows.getObject(1, UUID.class));
                    insert.setBigDecimal(2, BigDecimal.valueOf(rows.getDouble(2)));
                    insert.addBatch();
                }
                insert.executeBatch();
            }
            plugin.getLogger().info("Imported legacy Solaris balances from the shared Dune player table.");
        } catch (SQLException ignored) {
            // Older installations may not have enabled the shared player database.
        }
    }

    private void importLocalBalances(Connection c) {
        if (balances.isEmpty()) return;
        try (PreparedStatement insert = c.prepareStatement(
                "INSERT INTO dune_economy_balances(uuid,balance) VALUES (?,?) ON CONFLICT(uuid) DO NOTHING")) {
            for (Map.Entry<UUID, Double> entry : balances.entrySet()) {
                insert.setObject(1, entry.getKey());
                insert.setBigDecimal(2, BigDecimal.valueOf(entry.getValue()));
                insert.addBatch();
            }
            insert.executeBatch();
            plugin.getLogger().info("Migrated local Solaris balances into the shared economy database.");
        } catch (SQLException ex) {
            plugin.getLogger().warning("Could not migrate local Solaris balances to PostgreSQL: " + ex.getMessage());
        }
    }

    private static double money(double amount) {
        if (!Double.isFinite(amount)) return 0;
        return BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private synchronized void saveLocal() {
        for (Map.Entry<UUID, Double> entry : balances.entrySet()) data.set(entry.getKey().toString(), entry.getValue());
        try { data.save(file); }
        catch (IOException ex) { plugin.getLogger().severe("Could not save Solaris balances: " + ex.getMessage()); }
    }

    private synchronized double balance(UUID id) {
        if (databaseEnabled) {
            try (Connection c = connect(); PreparedStatement q = c.prepareStatement("SELECT balance FROM dune_economy_balances WHERE uuid=?")) {
                q.setObject(1, id);
                try (ResultSet row = q.executeQuery()) {
                    if (row.next()) {
                        double value = money(row.getDouble(1));
                        balances.put(id, value);
                        return value;
                    }
                }
            } catch (SQLException ex) { plugin.getLogger().warning("Solaris balance read failed: " + ex.getMessage()); }
        }
        return balances.getOrDefault(id, 0.0);
    }

    private synchronized void set(UUID id, double value) {
        value = money(value);
        balances.put(id, value);
        if (databaseEnabled) {
            try (Connection c = connect(); PreparedStatement q = c.prepareStatement(
                    "INSERT INTO dune_economy_balances(uuid,balance) VALUES (?,?) ON CONFLICT(uuid) DO UPDATE SET balance=EXCLUDED.balance")) {
                q.setObject(1, id); q.setBigDecimal(2, BigDecimal.valueOf(value)); q.executeUpdate();
            } catch (SQLException ex) { plugin.getLogger().severe("Solaris database save failed: " + ex.getMessage()); }
        }
        saveLocal();
    }

    synchronized void add(UUID id, double amount) { set(id, balance(id) + amount); }
    synchronized void subtract(UUID id, double amount) { set(id, balance(id) - amount); }

    private EconomyResponse response(double amount, double balance, EconomyResponse.ResponseType type, String message) {
        return new EconomyResponse(amount, balance, type, message);
    }
    private EconomyResponse deposit(OfflinePlayer player, double amount) {
        if (amount < 0 || !Double.isFinite(amount)) return response(amount, getBalance(player), EconomyResponse.ResponseType.FAILURE, "Amount must be non-negative.");
        set(player.getUniqueId(), getBalance(player) + amount);
        return response(amount, getBalance(player), EconomyResponse.ResponseType.SUCCESS, null);
    }
    private EconomyResponse withdraw(OfflinePlayer player, double amount) {
        double current = getBalance(player);
        if (amount < 0 || !Double.isFinite(amount)) return response(amount, current, EconomyResponse.ResponseType.FAILURE, "Amount must be non-negative.");
        if (!allowNegative && current < amount) return response(amount, current, EconomyResponse.ResponseType.FAILURE, "Insufficient funds.");
        set(player.getUniqueId(), current - amount);
        return response(amount, getBalance(player), EconomyResponse.ResponseType.SUCCESS, null);
    }

    @Override public boolean isEnabled() { return plugin.isEnabled(); }
    @Override public String getName() { return "DuneEss"; }
    @Override public boolean hasBankSupport() { return false; }
    @Override public int fractionalDigits() { return 0; }
    @Override public String format(double amount) { return String.format(java.util.Locale.US, "%,.0f %s", amount, Math.abs(amount) == 1 ? singular : plural); }
    @Override public String currencyNamePlural() { return plural; }
    @Override public String currencyNameSingular() { return singular; }
    @Override public boolean hasAccount(String name) { return hasAccount(Bukkit.getOfflinePlayer(name)); }
    @Override public boolean hasAccount(OfflinePlayer player) { return balances.containsKey(player.getUniqueId()) || player.hasPlayedBefore() || player.isOnline(); }
    @Override public boolean hasAccount(String name, String world) { return hasAccount(name); }
    @Override public boolean hasAccount(OfflinePlayer player, String world) { return hasAccount(player); }
    @Override public double getBalance(String name) { return getBalance(Bukkit.getOfflinePlayer(name)); }
    @Override public double getBalance(OfflinePlayer player) { return balance(player.getUniqueId()); }
    @Override public double getBalance(String name, String world) { return getBalance(name); }
    @Override public double getBalance(OfflinePlayer player, String world) { return getBalance(player); }
    @Override public boolean has(String name, double amount) { return has(Bukkit.getOfflinePlayer(name), amount); }
    @Override public boolean has(OfflinePlayer player, double amount) { return amount >= 0 && getBalance(player) >= amount; }
    @Override public boolean has(String name, String world, double amount) { return has(name, amount); }
    @Override public boolean has(OfflinePlayer player, String world, double amount) { return has(player, amount); }
    @Override public EconomyResponse withdrawPlayer(String name, double amount) { return withdraw(Bukkit.getOfflinePlayer(name), amount); }
    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, double amount) { return withdraw(player, amount); }
    @Override public EconomyResponse withdrawPlayer(String name, String world, double amount) { return withdrawPlayer(name, amount); }
    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, String world, double amount) { return withdraw(player, amount); }
    @Override public EconomyResponse depositPlayer(String name, double amount) { return deposit(Bukkit.getOfflinePlayer(name), amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, double amount) { return deposit(player, amount); }
    @Override public EconomyResponse depositPlayer(String name, String world, double amount) { return depositPlayer(name, amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, String world, double amount) { return deposit(player, amount); }
    @Override public EconomyResponse createBank(String name, String player) { return unsupported(); }
    @Override public EconomyResponse createBank(String name, OfflinePlayer player) { return unsupported(); }
    @Override public EconomyResponse deleteBank(String name) { return unsupported(); }
    @Override public EconomyResponse bankBalance(String name) { return unsupported(); }
    @Override public EconomyResponse bankHas(String name, double amount) { return unsupported(); }
    @Override public EconomyResponse bankWithdraw(String name, double amount) { return unsupported(); }
    @Override public EconomyResponse bankDeposit(String name, double amount) { return unsupported(); }
    @Override public EconomyResponse isBankOwner(String name, String player) { return unsupported(); }
    @Override public EconomyResponse isBankOwner(String name, OfflinePlayer player) { return unsupported(); }
    @Override public EconomyResponse isBankMember(String name, String player) { return unsupported(); }
    @Override public EconomyResponse isBankMember(String name, OfflinePlayer player) { return unsupported(); }
    @Override public List<String> getBanks() { return new ArrayList<>(); }
    @Override public boolean createPlayerAccount(String name) { return createPlayerAccount(Bukkit.getOfflinePlayer(name)); }
    @Override public boolean createPlayerAccount(OfflinePlayer player) {
        UUID id = player.getUniqueId();
        if (!balances.containsKey(id)) set(id, money(plugin.getConfig().getDouble("currency.starting-balance", 0)));
        return true;
    }
    @Override public boolean createPlayerAccount(String name, String world) { return createPlayerAccount(name); }
    @Override public boolean createPlayerAccount(OfflinePlayer player, String world) { return createPlayerAccount(player); }
    private EconomyResponse unsupported() { return response(0, 0, EconomyResponse.ResponseType.NOT_IMPLEMENTED, "DuneEss does not provide bank accounts."); }
}
