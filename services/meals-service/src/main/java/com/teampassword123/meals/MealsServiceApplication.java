package com.teampassword123.meals;

import com.teampassword123.meals.config.StorageProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(StorageProperties.class)
public class MealsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(MealsServiceApplication.class, args);
    }
}
