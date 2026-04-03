# Build Stage
FROM gradle:8.4-jdk21 AS build
COPY --chown=gradle:gradle . /home/gradle/src
WORKDIR /home/gradle/src
# Ktor's plugin creates a fat JAR containing all dependencies
RUN gradle buildFatJar --no-daemon

# Run Stage
FROM openjdk:21-jdk-slim
EXPOSE 8080
RUN mkdir /app
COPY --from=build /home/gradle/src/build/libs/*-all.jar /app/ktor.jar

# Run the compiled JAR
CMD ["java", "-jar", "/app/ktor.jar"]