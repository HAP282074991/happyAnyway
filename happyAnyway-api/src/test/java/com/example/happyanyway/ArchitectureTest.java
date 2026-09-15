package com.example.happyanyway;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.base.DescribedPredicate;
import org.springframework.stereotype.Service;
import org.apache.ibatis.annotations.Mapper;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

@AnalyzeClasses(packages = "com.example.happyanyway", importOptions = ImportOption.DoNotIncludeTests.class)
/** 对实际生产类执行分层及 Service 契约检查。 */
class ArchitectureTest {
    private static final DescribedPredicate<JavaClass> serviceImplementation = new DescribedPredicate<>("business Service implementation in any package") {
        @Override
        public boolean test(JavaClass type) {
            return !type.isInterface() && (type.getSimpleName().endsWith("ServiceImpl")
                    || type.isAnnotatedWith(Service.class) || type.isMetaAnnotatedWith(Service.class)
                    || type.getAllRawInterfaces().stream().anyMatch(contract ->
                    contract.getName().startsWith("com.example.happyanyway.service.")
                            && contract.getSimpleName().endsWith("Service")));
        }
    };
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

    @ArchTest
    static final ArchRule serviceContractsAreInterfaces = classes()
            .that().haveSimpleNameEndingWith("Service")
            .should().beInterfaces()
            .andShould().resideInAPackage("com.example.happyanyway.service.*")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule serviceImplementationsFollowContract = classes()
            .that(serviceImplementation)
            .should(new ArchCondition<JavaClass>("implement the matching Service interface in impl and register as Service") {
                @Override
                public void check(JavaClass type, ConditionEvents events) {
                    String name = type.getSimpleName();
                    String contract = name.endsWith("Impl") ? name.substring(0, name.length() - 4) : "";
                    String parent = type.getPackageName().replaceFirst("\\.impl$", "");
                    boolean valid = name.endsWith("ServiceImpl") && type.getPackageName().matches("com\\.example\\.happyanyway\\.service\\.[^.]+\\.impl")
                            && type.isAnnotatedWith(Service.class)
                            && type.getAllRawInterfaces().stream().anyMatch(i -> i.getName().equals(parent + "." + contract));
                    events.add(new SimpleConditionEvent(type, valid, type.getName() + " must implement its matching Service contract"));
                }
            }).allowEmptyShould(true);

    @ArchTest
    static final ArchRule callersUseServiceInterfaces = noClasses()
            .that().resideOutsideOfPackage("..config..")
            .should().dependOnClassesThat(serviceImplementation.or(JavaClass.Predicates.resideInAPackage("..service..impl..")))
            .allowEmptyShould(true);
}
