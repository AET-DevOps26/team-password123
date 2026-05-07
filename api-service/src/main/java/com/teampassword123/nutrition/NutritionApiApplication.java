package com.teampassword123.nutrition;

import com.teampassword123.nutrition.config.StorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(StorageProperties.class)
public class NutritionApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(NutritionApiApplication.class, args);
    }
}
