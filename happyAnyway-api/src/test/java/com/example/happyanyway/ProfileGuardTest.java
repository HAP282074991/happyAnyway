package com.example.happyanyway;

import com.example.happyanyway.config.ProfileGuard;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.context.support.GenericApplicationContext;

import static org.junit.jupiter.api.Assertions.*;

/** 验证互斥规则以及真实 Spring 启动入口的注册。 */
class ProfileGuardTest {
    @Test
    void individualProfilesRemainValid() {
        for (String profile : new String[]{"local", "mysql"}) {
            try (var context = new GenericApplicationContext()) {
                context.getEnvironment().setActiveProfiles(profile);
                assertDoesNotThrow(() -> new ProfileGuard().initialize(context));
            }
        }
    }

    @Test
    void mixedProfilesFailBeforeContextRefreshInEitherOrder() {
        for (String profiles : new String[]{"local,mysql", "mysql,local"}) {
            var application = new SpringApplication(Application.class);
            assertTrue(application.getInitializers().stream().anyMatch(ProfileGuard.class::isInstance));
            var failure = assertThrows(IllegalStateException.class, () -> application.run(
                    "--spring.profiles.active=" + profiles, "--spring.main.web-application-type=none"));
            assertTrue(failure.getMessage().contains("must not be active together"));
        }
    }
}
