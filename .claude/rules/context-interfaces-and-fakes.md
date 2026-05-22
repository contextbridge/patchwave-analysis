---
paths: ["src/**/*.ts"]
globs: ["src/**/*.ts"]
---

# Context Interfaces and Fakes

- **Injectable dependencies should have a public contract and separate implementations.** When adding a dependency that performs I/O, external API calls, filesystem access, or other side effects, define a narrow public interface for the behavior callers depend on. Callers accept the interface; production code wires up the real implementation.

- **Name the production implementation `XxxImpl`.** The real implementation implements the public interface and carries the environment-specific behavior. Consumer parameters and struct fields should be typed as the interface, not the concrete implementation.

- **Name the test implementation `FakeXxx`.** Shared test helpers implement the same public interface with deterministic, inspectable behavior. Keep fakes focused on the interface contract so tests can swap them in without casts, module mocking, or duplicating production implementation details.

- **Pass dependencies as plain function arguments or a small `Context` object.** Don't reach for module-level mutable singletons or globals; they make tests order-dependent and force module mocking. Collectors and other long-running operations should accept their client/IO dependencies as arguments.
