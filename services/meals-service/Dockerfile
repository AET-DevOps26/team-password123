FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
RUN mvn -B -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /workspace/target/*.jar app.jar
# Run as a non-root, numeric UID; pre-create the uploads dir it owns so the
# mounted volume inherits writable ownership (k8s pairs this with fsGroup 1001).
RUN addgroup -g 1001 -S spring && adduser -u 1001 -S spring -G spring \
    && mkdir -p /app/uploads && chown -R spring:spring /app
USER 1001
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8082/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
