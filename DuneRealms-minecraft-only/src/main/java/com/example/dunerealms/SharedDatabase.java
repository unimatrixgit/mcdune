package com.example.dunerealms;

import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.util.io.BukkitObjectInputStream;
import org.bukkit.util.io.BukkitObjectOutputStream;
import org.bukkit.plugin.java.JavaPlugin;
import java.io.*;
import java.sql.*;
import java.util.*;
import java.util.Base64;

/** PostgreSQL-backed network player state and shared politics state. */
public final class SharedDatabase {
    private final JavaPlugin plugin;
    private final String url,user,password;
    public SharedDatabase(JavaPlugin plugin) throws SQLException {
        this.plugin=plugin;
        url=plugin.getConfig().getString("database.jdbc-url","");
        user=plugin.getConfig().getString("database.username","");
        password=plugin.getConfig().getString("database.password","");
        if(url.isBlank())throw new SQLException("database.jdbc-url is required");
        try(Connection c=connect();Statement s=c.createStatement()){
            s.executeUpdate("CREATE TABLE IF NOT EXISTS dune_players (uuid UUID PRIMARY KEY, faction TEXT NOT NULL DEFAULT '', solaris INTEGER NOT NULL DEFAULT 0, inventory TEXT)");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS dune_politics (id INTEGER PRIMARY KEY, yaml TEXT NOT NULL)");
            s.executeUpdate("INSERT INTO dune_politics (id,yaml) VALUES (1,'') ON CONFLICT (id) DO NOTHING");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS dune_arrakis_permits (player UUID PRIMARY KEY, expires_at BIGINT NOT NULL)");
            s.executeUpdate("CREATE TABLE IF NOT EXISTS dune_bounties (target UUID PRIMARY KEY, world TEXT NOT NULL, reward INTEGER NOT NULL, claimed BOOLEAN NOT NULL DEFAULT FALSE, hunter UUID)");
        }
    }
    public Connection connect() throws SQLException {return DriverManager.getConnection(url,user,password);}
    public void loadPlayer(Player p,Map<UUID,String> factions,Map<UUID,Integer> money) throws Exception {
        try(Connection c=connect()){
            try(PreparedStatement ins=c.prepareStatement("INSERT INTO dune_players(uuid) VALUES (?) ON CONFLICT DO NOTHING")){
                ins.setObject(1,p.getUniqueId());ins.executeUpdate();
            }
            try(PreparedStatement q=c.prepareStatement("SELECT faction,solaris,inventory FROM dune_players WHERE uuid=?")){
                q.setObject(1,p.getUniqueId());
                try (ResultSet r = q.executeQuery()) {
                    if (r.next()) {
                    factions.put(p.getUniqueId(),r.getString(1));money.put(p.getUniqueId(),r.getInt(2));
                    String blob=r.getString(3);
                    if(blob!=null && !blob.isBlank()){
                        ItemStack[] contents=decode(blob);
                        p.getInventory().setContents(contents);
                    }
                }
            }
        }
    }
    public void savePlayer(Player p,Map<UUID,String> factions,Map<UUID,Integer> money) throws Exception {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement(
            "INSERT INTO dune_players(uuid,faction,solaris,inventory) VALUES(?,?,?,?) ON CONFLICT(uuid) DO UPDATE SET faction=EXCLUDED.faction,solaris=EXCLUDED.solaris,inventory=EXCLUDED.inventory")){
            q.setObject(1,p.getUniqueId());q.setString(2,factions.getOrDefault(p.getUniqueId(),""));
            q.setInt(3,money.getOrDefault(p.getUniqueId(),0));q.setString(4,encode(p.getInventory().getContents()));q.executeUpdate();
        }
    }
    public String loadPolitics() throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement("SELECT yaml FROM dune_politics WHERE id=1");ResultSet r=q.executeQuery()){
            return r.next()?r.getString(1):"";
        }
    }
    public void savePolitics(String yaml) throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement("UPDATE dune_politics SET yaml=? WHERE id=1")){
            q.setString(1,yaml);q.executeUpdate();
        }
    }
    /** Short-lived, single-use authorization for an Emperor-approved arrival. */
    public void issueArrakisPermit(UUID player,long expiresAt) throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement(
          "INSERT INTO dune_arrakis_permits(player,expires_at) VALUES (?,?) ON CONFLICT(player) DO UPDATE SET expires_at=EXCLUDED.expires_at")){
            q.setObject(1,player);q.setLong(2,expiresAt);q.executeUpdate();
        }
    }
    public boolean consumeArrakisPermit(UUID player) throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement(
          "DELETE FROM dune_arrakis_permits WHERE player=? AND expires_at>? RETURNING player")){
            q.setObject(1,player);q.setLong(2,System.currentTimeMillis());
            try(ResultSet r=q.executeQuery()){return r.next();}
        }
    }
    public void issueBounty(UUID target,String world,int reward) throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement(
            "INSERT INTO dune_bounties(target,world,reward,claimed,hunter) VALUES(?,?,?,FALSE,NULL) ON CONFLICT(target) DO UPDATE SET world=EXCLUDED.world,reward=EXCLUDED.reward,claimed=FALSE,hunter=NULL")){
            q.setObject(1,target);q.setString(2,world);q.setInt(3,reward);q.executeUpdate();
        }
    }
    public int claimBounty(UUID target,UUID hunter) throws SQLException {
        try(Connection c=connect();PreparedStatement q=c.prepareStatement(
            "UPDATE dune_bounties SET claimed=TRUE,hunter=? WHERE target=? AND claimed=FALSE RETURNING reward")){
            q.setObject(1,hunter);q.setObject(2,target);
            try(ResultSet r=q.executeQuery()){return r.next()?r.getInt(1):0;}
        }
    }
    private String encode(ItemStack[] items) throws Exception {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        try(BukkitObjectOutputStream out=new BukkitObjectOutputStream(bytes)){out.writeInt(items.length);for(ItemStack i:items)out.writeObject(i);}
        return Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
    private ItemStack[] decode(String str) throws Exception {
        try(BukkitObjectInputStream in=new BukkitObjectInputStream(new ByteArrayInputStream(Base64.getDecoder().decode(str)))){
            int n=in.readInt();if(n<0||n>54)throw new IOException("Invalid inventory length");
            ItemStack[] items=new ItemStack[n];for(int i=0;i<n;i++)items[i]=(ItemStack)in.readObject();return items;
        }
    }
}
