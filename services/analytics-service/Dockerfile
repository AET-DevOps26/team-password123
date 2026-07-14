FROM maven:3-eclipse-temurin-26 AS build
# Build context is services/ so the shared common-security module is available.
WORKDIR /workspace
COPY common-security/pom.xml common-security/pom.xml
COPY common-security/src common-security/src
RUN mvn -B -q -f common-security/pom.xml -DskipTests install
COPY analytics-service/pom.xml analytics-service/pom.xml
RUN mvn -B -q -f analytics-service/pom.xml -DskipTests dependency:go-offline
COPY analytics-service/src analytics-service/src
RUN mvn -B -q -f analytics-service/pom.xml -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /workspace/analytics-service/target/*.jar app.jar
# Run as a non-root, numeric UID so Kubernetes runAsNonRoot can verify it.
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring && chown -R spring:spring /app
USER 1001
EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8083/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
