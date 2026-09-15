package com.example.happyanyway.config;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Profiles;

/** 在容器刷新及数据库初始化之前拒绝互相冲突的运行模式。 */
public final class ProfileGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    @Override
    public void initialize(ConfigurableApplicationContext context) {
        var environment = context.getEnvironment();
        if (environment.acceptsProfiles(Profiles.of("local & mysql"))) {
            throw new IllegalStateException("Profiles local and mysql must not be active together");
        }
    }
}
