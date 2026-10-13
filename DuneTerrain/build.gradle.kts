plugins { java }

group = "com.example"
version = "1.0.3"

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:1.21.4-R0.1-SNAPSHOT")
}

java { toolchain.languageVersion.set(JavaLanguageVersion.of(21)) }
tasks.jar { archiveBaseName.set("DuneTerrain") }
tasks.withType<JavaCompile> { options.encoding = "UTF-8" }
