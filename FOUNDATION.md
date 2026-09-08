# Foundation

This document defines the foundational concepts of `react-form-engine`.

Its purpose is to establish the mental model and the main structural decisions before getting into implementation details.

For now, this document describes the architecture, responsibilities, and direction of the system, but it does not attempt to finalize the public API or every internal detail.

> **Note:** for now, this document is a living draft of the engine's foundational rules and decisions.

## FormStore

`FormStore` represents a single form instance.

- There may be multiple `FormStore`s on screen if the user has multiple independent forms.
- The user does not access the `FormStore` directly.
- `FormStore` is the real center of the form.
- `FormStore` owns the real data source, the system's base state, and the internal logic needed to operate on them.
- Internally, `FormStore` is composed of separate pieces: one owns the structural identity of every location, one owns the base state, and one owns the value.
- None of those pieces knows the others. An operation that needs more than one of them cannot live inside any of them, and belongs to `FormStore` or to something it composes.

For now, `FormStore` should be understood as the internal representation of a form.

### FormStore Structures

For now, `FormStore` is conceived around three main structures.

These structures are not yet their final detailed definition, but they do establish the direction of the internal architecture.

#### Values

`values` contains the real data of the form.

- It must preserve the natural shape of the user's value.
- It must not be contaminated with internal engine wrappers.
- It is the real data source of the form.

#### Defaults

`defaults` contains the base value of the form.

- It is kept separate from `values`.
- It serves as the reference for comparisons and resets.
- It is not part of field metadata state.

#### States

`states` contains the cached base metadata of the form's `Field`s.

- It does not store the real value of a `Field`.
- It stores only the base state associated with each `Field`.
- Its main role is to provide fast access to state without recalculating it all the time.

For now, `states` should be understood as a structure oriented around metadata rather than data.

`states` only contains the base state of `Field`s.

`Node`s do not introduce a separate base state source inside this structure.

##### What it stores

Each `states` entry stores:

- `flags`
- `errors`

`flags` represents, in compact form, the base boolean state of a `Field`.

Among other things, these flags must be able to express:

- whether the `Field` is valid
- whether the `Field` was touched
- whether the `Field` changed relative to its base value
- whether the `Field` is currently being validated

`errors` represents the errors directly associated with that `Field`.

It does not represent the aggregated state of a set of `Field`s, but only the errors that belong to that specific location inside the form.

##### How it is calculated

Each `Field` calculates its own state from:

- its current value in `values`
- its base value in `defaults`
- its validation result

##### Purpose

`states` exists so that `FormStore` can answer the base state of any `Field` quickly, without fully recalculating it on every read.

### Assignment

Assigning a value never makes a location observed, and never stops one from being observed. Observation has its own explicit lifecycle.

Assigning reaches a location; it does not declare what that location is. A value whose shape disagrees with what was already claimed there is not a conflict of assignment.

`null` and `undefined` are values a caller may assign, and they are preserved as such.

The absence of a property is therefore not expressed by assigning `undefined` to it. Whether a property is really there is a separate question from what its value is.

### Arrays

Arrays are a real part of `FormStore`.

They do not appear here as a closed base structure at the same level as `values`, `defaults`, or `states`, but they do exist as a real internal piece of its composition.

An array is a `Node` whose structure can change without ceasing to represent the same location inside the form.

Unlike other `Node`s, an array does not only contain descendants.  
It also contains a sequence of elements whose position is part of its behavior.

Because of that, an array has its own rules inside the system.

- Its real value lives in `values`.
- Its structural changes are not modeled as ordinary `Field` changes.
- Its fine-grained control does not create a parallel data source.
- That fine-grained control is exposed through `useFieldArray`.

`useFieldArray` always operates on the real array of the form.

Its responsibility is to allow fine structural operations such as inserting, removing, moving, or swapping elements.

#### Identity of its elements

Each element of an array has an identity of its own, separate from the position it occupies.

Structural operations preserve that identity while positions move around it. That is what allows an element to keep its state and its reactive links after the list is reordered.

Assigning an array as a whole cannot preserve it. The same resulting list could come from an insertion, a reordering, or a full substitution, and nothing in the assigned value says which element corresponds to which one before it.

For that reason, assigning a whole array discards the identities of its elements, along with everything keyed by them, and mints new ones.

## Control

`Control` is not the god object.

`Control` is a key that gives access to a `FormStore`.

- A `Control` has limited operations for managing fields.
- A `Control` does not own the real state of the form.
- A `Control` delegates its operations to `FormStore`.
- A `Control` internally preserves the absolute reference needed to resolve its real position inside the form.

The important idea is that a `Control` is defined by the fields it can manage.

A `Control` can represent either the whole form or a partial projection of it.

That projection defines the domain of `Path`s over which the `Control` can operate.

That same domain also delimits the set of `states` that can be read and aggregated from that `Control`.

### Control Derivation

A `Control` can create more controls from itself.

This does not replace the original control.

- The original `Control` continues to exist.
- The original `Control` continues to control the fields it already had.
- A new `Control` is created with access only to a subset of fields defined at the moment of its creation.

This means that a `Control` can subdivide access without losing its own access.

All controls are conceptually the same kind of object.

- There is no special root control by nature.
- A control that can manage all fields is still just another `Control`.
- The only difference between controls is which fields they can manage.

### Relationship between FormStore and Control

A `FormStore` does not exist because a `Control` exists, but in practice a `FormStore` only makes sense if at least one `Control` is using its fields.

Every `Control` is connected to the same `FormStore`.

- Any change made through a `Control` is applied to the `FormStore`.
- `FormStore` is responsible for reporting changes through its subscription system.
- No specific `Control` should become special because of that.

This means that `FormStore` remains the only source of truth, and each `Control` is only a restricted operational access point over that same source.

## Paths

`Path` is the route that identifies a location inside the form.

A `Path` does not define by itself the nature of that location.

It only expresses how to reach that location inside the form structure.

Examples:

- `person`
- `person.name`
- `person.contact_info.phone`
- `person.homes.0.city`

### Field

`Field` is a terminal unit of the form.

A `Field` represents a location that no longer contains deeper children inside the form model.

`Field`s are the specific units over which direct value, base state, and direct validation exist.

Examples:

- `person.name`
- `person.birthdate`
- `person.contact_info.phone`
- `active`

### Node

`Node` is a composite unit of the form.

A `Node` represents a location that contains other `Field`s, other `Node`s, or both.

`Node`s exist to express structure, grouping, and scopes inside the form.

Examples:

- `person`
- `person.contact_info`
- `person.homes`
- `person.homes.0`

### Relationship between them

Every `Field` and every `Node` exists on top of a `Path`.

- `Path` is the route.
- `Field` is a terminal unit located on a route.
- `Node` is a composite unit located on a route.

What a location is settles when something claims it, and the value living there does not change it. Assigning an object to a `Field` does not turn that location into a `Node`.

A location claimed as a `Field` because nothing was known to live inside it stops being terminal the moment something registers underneath it. It keeps its identity while doing so, so whatever was already keyed by that location survives the change.

## useForm

`useForm` is the main entry point of the system.

Every form begins in `useForm`.

Its responsibility is to create the base universe of the form.

That universe defines the full initial scope over which the system can operate.

### What it creates

`useForm` creates, among other things:

- the `FormStore`
- the root `Control`

From that point onward, the form exists as a complete unit inside the system.

### What it represents

The universe created by `useForm` represents the form as a complete surface.

That means the system begins from the idea that the form can be read, validated, and submitted as a whole.

### usePatchForm

`usePatchForm` is a variation of `useForm`.

It does not create a different universe.

It creates the same base universe of the form, but under a patch semantics.

#### What changes

In `usePatchForm`, the system does not interpret the form as a full replacement of its value.

It interprets it as a partial modification over an already existing base.

For that reason, `usePatchForm` introduces different rules over:

- assignment
- validation activation
- the way in which the form expresses its result

##### Assignment under patch semantics

Assigning a value to a `Node` does not replace it.

Only the properties the assigned value carries are written. Everything the value does not name is left as it was: its own value, its state, and the identity of its elements.

A property that is present is written as it came, `null` and `undefined` included. A property that is absent was never meant to be written, so nothing underneath it is visited at all.

An array named by the assigned value is still assigned as a whole, with the consequences that has for the identity of its elements. An array the value does not name is not touched.

## useFormState

`useFormState` is a state aggregation hook.

Its responsibility is to read the `states` that belong to the domain of a `Control` and produce, from them, a new derived aggregated state.

`useFormState` does not create a new domain and does not modify the domain of the `Control`.

The `Control` defines the set of paths over which the hook can operate, and `useFormState` only aggregates state inside that set.

`useFormState` receives a `Control` and can restrict its aggregation to a specific `Path` inside that `Control`'s domain.

The resulting state makes it possible to know, among other things:

- whether the observed set is valid
- whether at least one field is touched
- whether at least one field is dirty
- whether at least one validation is in progress
- whether at least one error exists

The resulting state does not constitute a separate base source of truth apart from `states`, but a derived projection built on top of them.

## useFieldArray

`useFieldArray` is the specialized key for fine-grained control over a form array.

It operates on an array `Path` that belongs to the domain of a `Control`.

`useFieldArray` does not create a new domain and does not redefine the value of the array.

Its responsibility is to provide access to the structural behavior of the real array of the form.

Among other things, this includes operations such as:

- inserting elements
- removing elements
- moving elements
- swapping positions

`useFieldArray` does not work on an independent copy.

It always operates on the real array contained in `values`.

There may be multiple uses of `useFieldArray` pointing to the same array.

In that case, all of them operate on the same structural reality and remain synchronized with each other.

`useFieldArray` operations are always resolved against the current state of the real array in the form, not against a local copy of the instance that invoked them.
