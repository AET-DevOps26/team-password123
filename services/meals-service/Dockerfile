FROM maven:3-eclipse-temurin-26 AS build
# Build context is services/ so the shared common-security module is available.
WORKDIR /workspace
COPY common-security/pom.xml common-security/pom.xml
COPY common-security/src common-security/src
# Formatting is enforced by the CI backend job (JDK 21); google-java-format
# cannot run on this newer build-stage JDK, and an image build shouldn't gate
# on style anyway.
RUN mvn -B -q -f common-security/pom.xml -DskipTests -Dspotless.check.skip=true install
COPY meals-service/pom.xml meals-service/pom.xml
RUN mvn -B -q -f meals-service/pom.xml -DskipTests dependency:go-offline
COPY meals-service/src meals-service/src
RUN mvn -B -q -f meals-service/pom.xml -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /workspace/meals-service/target/*.jar app.jar
# Run as a non-root, numeric UID; pre-create the uploads dir it owns so the
# mounted volume inherits writable ownership (k8s pairs this with fsGroup 1001).
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring \
    && mkdir -p /app/uploads && chown -R spring:spring /app
USER 1001
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8082/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
