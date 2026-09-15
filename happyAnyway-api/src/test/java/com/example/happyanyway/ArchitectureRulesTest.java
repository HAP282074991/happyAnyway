package com.example.happyanyway;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.tools.ToolProvider;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** 编译隔离的正反样例，证明生产架构规则能检测真实字节码依赖。 */
class ArchitectureRulesTest {
    @TempDir
    Path temporary;
    private int sequence;

    private boolean violates(ArchRule rule, Map<String, String> sources) throws Exception {
        Path directory = Files.createDirectory(temporary.resolve("case" + sequence++));
        var arguments = new ArrayList<String>();
        arguments.addAll(java.util.List.of("-classpath", System.getProperty("java.class.path"), "-d", directory.toString()));
        for (var entry : sources.entrySet()) {
            Path source = directory.resolve(entry.getKey().replace('.', '/') + ".java");
            Files.createDirectories(source.getParent());
            String fullName = entry.getKey();
            Files.writeString(source, "package " + fullName.substring(0, fullName.lastIndexOf('.')) + ";\n" + entry.getValue());
            arguments.add(source.toString());
        }
        assertEquals(0, ToolProvider.getSystemJavaCompiler().run(null, null, null, arguments.toArray(String[]::new)));
        return rule.evaluate(new ClassFileImporter().importPath(directory)).hasViolation();
    }

    private void dependency(ArchRule rule, String from, String forbidden, String allowed) throws Exception {
        String root = "com.example.happyanyway.";
        for (String target : new String[]{forbidden, allowed}) {
            assertEquals(target.equals(forbidden), violates(rule, Map.of(
                    root + from + ".Caller", "public class Caller { " + root + target + ".Target value; }",
                    root + target + ".Target", "public class Target {}")));
        }
    }

    @Test
    void layerRulesRejectForbiddenAndAcceptAllowedDependencies() throws Exception {
        dependency(ArchitectureTest.controllersUseServicesAndDtos, "controller.demo", "mapper.demo", "service.demo");
        dependency(ArchitectureTest.controllersUseServicesAndDtos, "controller.demo", "entity.demo", "dto.demo");
        dependency(ArchitectureTest.servicesDoNotDependOnControllers, "service.demo", "controller.demo", "mapper.demo");
        dependency(ArchitectureTest.mappersDoNotDependOnUpperLayers, "mapper.demo", "service.demo", "entity.demo");
        dependency(ArchitectureTest.dataModelsDoNotDependOnBehaviorLayers, "dto.demo", "service.demo", "entity.demo");
        dependency(ArchitectureTest.securityDoesNotAccessMappers, "security", "mapper.demo", "service.demo");
        dependency(ArchitectureTest.commonDoesNotDependOnBusinessLayers, "common", "service.demo", "external");
        dependency(ArchitectureTest.callersUseServiceInterfaces, "controller.demo", "service.demo.impl", "service.demo");
        dependency(ArchitectureTest.callersUseServiceInterfaces, "service.other.impl", "service.demo.impl", "service.demo");
    }

    @Test
    void annotationLocationsHavePositiveAndNegativeExamples() throws Exception {
        ArchRule[] rules = {ArchitectureTest.restControllersBelongInController,
                ArchitectureTest.mvcControllersBelongInController, ArchitectureTest.mybatisMappersBelongInMapper};
        String[] annotations = {"org.springframework.web.bind.annotation.RestController", "org.springframework.stereotype.Controller", "org.apache.ibatis.annotations.Mapper"};
        for (int index = 0; index < rules.length; index++) {
            String layer = index == 2 ? "mapper" : "controller";
            for (String location : new String[]{layer, "common"}) {
                assertEquals(location.equals("common"), violates(rules[index], Map.of(
                        "com.example.happyanyway." + location + ".Sample", "@" + annotations[index] + " public class Sample {}")));
            }
        }
    }

    @Test
    void cyclesAreRejectedAndOneWayDependenciesPass() throws Exception {
        for (boolean cycle : new boolean[]{false, true}) {
            assertEquals(cycle, violates(ArchitectureTest.topLevelPackagesAreAcyclic, Map.of(
                    "com.example.happyanyway.controller.A", "public class A { com.example.happyanyway.service.B b; }",
                    "com.example.happyanyway.service.B", "public class B { " + (cycle ? "com.example.happyanyway.controller.A a;" : "") + " }")));
        }
    }

    @Test
    void serviceContractAndImplementationExamples() throws Exception {
        String contract = "com.example.happyanyway.service.demo.SampleService";
        assertFalse(violates(ArchitectureTest.serviceContractsAreInterfaces, Map.of(contract, "public interface SampleService {}")));
        assertTrue(violates(ArchitectureTest.serviceContractsAreInterfaces, Map.of(contract, "public class SampleService {}")));
        for (String body : new String[]{
                "@org.springframework.stereotype.Service public class SampleServiceImpl implements " + contract + " {}",
                "public class SampleServiceImpl implements " + contract + " {}",
                "@org.springframework.stereotype.Service public class SampleServiceImpl {}"}) {
            assertEquals(!body.startsWith("@") || !body.contains(" implements "), violates(
                    ArchitectureTest.serviceImplementationsFollowContract, Map.of(
                            contract, "public interface SampleService {}",
                            "com.example.happyanyway.service.demo.impl.SampleServiceImpl", body)));
        }
        assertTrue(violates(ArchitectureTest.serviceImplementationsFollowContract, Map.of(
                contract, "public interface SampleService {}",
                "com.example.happyanyway.service.demo.SampleServiceImpl",
                "@org.springframework.stereotype.Service public class SampleServiceImpl implements SampleService {}")));
    }

    @Test
    void serviceTypesCannotEscapeChecksByMovingOrRenaming() throws Exception {
        String contract = "com.example.happyanyway.service.demo.SampleService";
        String misplaced = "com.example.happyanyway.feature.SampleServiceImpl";
        var sources = new java.util.HashMap<String, String>();
        sources.put(contract, "public interface SampleService {}");
        sources.put(misplaced, "@org.springframework.stereotype.Service public class SampleServiceImpl implements " + contract + " {}");
        sources.put("com.example.happyanyway.controller.demo.SampleController",
                "public class SampleController { private final " + misplaced + " service; public SampleController(" + misplaced + " service) { this.service = service; } }");
        assertTrue(violates(ArchitectureTest.serviceImplementationsFollowContract, sources));
        assertTrue(violates(ArchitectureTest.callersUseServiceInterfaces, sources));
        assertTrue(violates(ArchitectureTest.serviceContractsAreInterfaces, Map.of(
                "com.example.happyanyway.feature.SampleService", "public interface SampleService {}")));
        assertTrue(violates(ArchitectureTest.serviceImplementationsFollowContract, Map.of(
                contract, "public interface SampleService {}",
                "com.example.happyanyway.feature.Renamed", "public class Renamed implements " + contract + " {}")));
        assertTrue(violates(ArchitectureTest.serviceImplementationsFollowContract, Map.of(
                "com.example.happyanyway.feature.Renamed", "@org.springframework.stereotype.Service public class Renamed {}")));
    }

    @Test
    void interfaceInjectionAndConfigurationAssemblyRemainAllowed() throws Exception {
        String contract = "com.example.happyanyway.service.demo.SampleService";
        String implementation = "com.example.happyanyway.service.demo.impl.SampleServiceImpl";
        var sources = Map.of(
                contract, "public interface SampleService {}",
                implementation, "@org.springframework.stereotype.Service public class SampleServiceImpl implements " + contract + " {}",
                "com.example.happyanyway.controller.demo.SampleController", "public class SampleController { " + contract + " service; }",
                "com.example.happyanyway.config.Assembly", "public class Assembly { " + implementation + " implementation; }",
                "com.example.happyanyway.service.demo.Helper", "public class Helper {}");
        assertFalse(violates(ArchitectureTest.serviceContractsAreInterfaces, sources));
        assertFalse(violates(ArchitectureTest.serviceImplementationsFollowContract, sources));
        assertFalse(violates(ArchitectureTest.callersUseServiceInterfaces, sources));
    }
}
