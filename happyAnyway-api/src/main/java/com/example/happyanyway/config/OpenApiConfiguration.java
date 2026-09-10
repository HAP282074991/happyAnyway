package com.example.happyanyway.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfiguration {
    @Bean
    OpenAPI happyAnywayOpenApi() {
        return new OpenAPI().info(new Info().title("happyAnyway API").version("v1")
                .description("Development foundation; business APIs have not been defined."));
    }
}
