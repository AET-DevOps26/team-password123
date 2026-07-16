FROM maven:3-eclipse-temurin-26 AS build
# Build context is services/ so the shared common-security module is available.
WORKDIR /workspace
COPY common-security/pom.xml common-security/pom.xml
COPY common-security/src common-security/src
# Formatting and static analysis are enforced by the CI backend job (JDK 21);
# google-java-format cannot run on this newer build-stage JDK, the shared
# checkstyle.xml is not part of the copied context, and an image build
# shouldn't gate on style anyway.
RUN mvn -B -q -f common-security/pom.xml -DskipTests -Dspotless.check.skip=true -Dcheckstyle.skip=true install
COPY auth-service/pom.xml auth-service/pom.xml
RUN mvn -B -q -f auth-service/pom.xml -DskipTests dependency:go-offline
COPY auth-service/src auth-service/src
RUN mvn -B -q -f auth-service/pom.xml -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /workspace/auth-service/target/*.jar app.jar
# Run as a non-root, numeric UID so Kubernetes runAsNonRoot can verify it.
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring && chown -R spring:spring /app
USER 1001
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8081/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
