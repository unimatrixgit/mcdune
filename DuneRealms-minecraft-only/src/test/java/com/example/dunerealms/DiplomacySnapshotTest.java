package com.example.dunerealms;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class DiplomacySnapshotTest {
    @Test void publicOfficesExcludeBallotsIdsAndExpiredAppointments() throws Exception {
        var record=new YamlConfiguration(); String id=UUID.randomUUID().toString(); long week=42;
        record.set("votes.emperor.42.tally."+id,2);
        record.set("votes.emperor.42.names."+id,"MuadDib");
        record.set("votes.house.42.Fremen.tally."+id,1);
        record.set("votes.house.42.Fremen.names."+id,"MuadDib");
        record.set("appointments.steward.week",42);
        record.set("appointments.steward.emperor",id);
        record.set("appointments.steward.house","Atreides");
        record.set("appointments.water.week",41);
        record.set("appointments.water.emperor",id);
        record.set("appointments.water.house","Corrino");
        var snapshot=Politics.publicSnapshot(record,week);
        assertEquals("MuadDib",snapshot.get("emperor"));
        assertEquals("Atreides",snapshot.get("spiceSteward"));
        assertNull(snapshot.get("houseOfWater"));
        assertFalse(snapshot.toString().contains(id));
        assertNull(Politics.publicSnapshot(record,43).get("emperor"));
        record.set("votes.emperor.42.tally."+UUID.randomUUID(),3);
        assertNull(Politics.publicSnapshot(record,42).get("spiceSteward"));
        assertTrue(DiscordWebFeed.encode("{}","DUNE_DIPLOMACY").getFirst().startsWith("DUNE_DIPLOMACY "));
        assertThrows(IllegalArgumentException.class,()->DiscordWebFeed.encode("{}","BAD"));
    }
}
