package com.example.happyanyway;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.apache.ibatis.annotations.Mapper;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(packages = "com.example.happyanyway", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    // Empty business layers are expected until actual business classes are introduced.
    @ArchTest
    static final ArchRule controllersUseServicesAndDtos = noClasses()
            .that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAnyPackage("..mapper..", "..entity..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule servicesDoNotDependOnControllers = noClasses()
            .that().resideInAPackage("..service..")
            .should().dependOnClassesThat().resideInAPackage("..controller..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule mappersDoNotDependOnUpperLayers = noClasses()
            .that().resideInAPackage("..mapper..")
            .should().dependOnClassesThat().resideInAnyPackage("..service..", "..controller..", "..dto..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule dataModelsDoNotDependOnBehaviorLayers = noClasses()
            .that().resideInAnyPackage("..entity..", "..dto..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..controller..", "..service..", "..mapper..", "..security..", "..config..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule securityDoesNotAccessMappers = noClasses()
            .that().resideInAPackage("..security..")
            .should().dependOnClassesThat().resideInAPackage("..mapper..");

    @ArchTest
    static final ArchRule commonDoesNotDependOnBusinessLayers = noClasses()
            .that().resideInAPackage("..common..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..controller..", "..service..", "..mapper..", "..entity..", "..dto..",
                    "..security..", "..config..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule restControllersBelongInController = classes()
            .that().areAnnotatedWith(RestController.class)
            .should().resideInAPackage("..controller..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule mvcControllersBelongInController = classes()
            .that().areAnnotatedWith(Controller.class)
            .should().resideInAPackage("..controller..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule mybatisMappersBelongInMapper = classes()
            .that().areAnnotatedWith(Mapper.class)
            .should().resideInAPackage("..mapper..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule topLevelPackagesAreAcyclic = slices()
            .matching("com.example.happyanyway.(*)..")
            .should().beFreeOfCycles();
}
