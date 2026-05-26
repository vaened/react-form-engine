import type { ArrayPath, FieldPath, NodePath, Path, PathValue } from "../../index";
import type { Equal, Expect, Extends } from "./type-assertions";

type RecursiveNode = {
  value: string;
  next?: RecursiveNode;
  children: RecursiveNode[];
};

type RecursiveTupleNode = {
  pair: [RecursiveTupleNode, string[]];
};

type RecursiveExpectedPath = "value" | "next" | "children" | `children.${number}`;
type RecursiveExpectedFieldPath = "value";
type RecursiveExpectedNodePath = "next" | "children" | `children.${number}`;
type RecursiveExpectedArrayPath = "children" | `children.${number}`;

type RecursivePathExpectationA = Expect<Extends<Path<RecursiveNode>, RecursiveExpectedPath>>;
type RecursivePathExpectationB = Expect<Extends<RecursiveExpectedPath, Path<RecursiveNode>>>;
type RecursiveFieldPathExpectationA = Expect<Extends<FieldPath<RecursiveNode>, RecursiveExpectedFieldPath>>;
type RecursiveFieldPathExpectationB = Expect<Extends<RecursiveExpectedFieldPath, FieldPath<RecursiveNode>>>;
type RecursiveNodePathExpectationA = Expect<Extends<NodePath<RecursiveNode>, RecursiveExpectedNodePath>>;
type RecursiveNodePathExpectationB = Expect<Extends<RecursiveExpectedNodePath, NodePath<RecursiveNode>>>;
type RecursiveArrayPathExpectationA = Expect<Extends<ArrayPath<RecursiveNode>, RecursiveExpectedArrayPath>>;
type RecursiveArrayPathExpectationB = Expect<Extends<RecursiveExpectedArrayPath, ArrayPath<RecursiveNode>>>;

type RecursiveValueExpectation = Expect<Equal<PathValue<RecursiveNode, "value">, string>>;
type RecursiveNextExpectation = Expect<Equal<PathValue<RecursiveNode, "next">, RecursiveNode | undefined>>;
type RecursiveChildrenExpectation = Expect<Equal<PathValue<RecursiveNode, "children">, RecursiveNode[]>>;
type RecursiveChildItemExpectation = Expect<Equal<PathValue<RecursiveNode, "children.0">, RecursiveNode>>;

type RecursiveTupleExpectedPath = "pair" | "pair.0" | "pair.1" | `pair.1.${number}`;
type RecursiveTupleExpectedFieldPath = `pair.1.${number}`;
type RecursiveTupleExpectedNodePath = "pair" | "pair.0" | "pair.1";
type RecursiveTupleExpectedArrayPath = "pair.1";

type RecursiveTuplePathExpectationA = Expect<Extends<Path<RecursiveTupleNode>, RecursiveTupleExpectedPath>>;
type RecursiveTuplePathExpectationB = Expect<Extends<RecursiveTupleExpectedPath, Path<RecursiveTupleNode>>>;
type RecursiveTupleFieldPathExpectationA = Expect<
  Extends<FieldPath<RecursiveTupleNode>, RecursiveTupleExpectedFieldPath>
>;
type RecursiveTupleFieldPathExpectationB = Expect<
  Extends<RecursiveTupleExpectedFieldPath, FieldPath<RecursiveTupleNode>>
>;
type RecursiveTupleNodePathExpectationA = Expect<Extends<NodePath<RecursiveTupleNode>, RecursiveTupleExpectedNodePath>>;
type RecursiveTupleNodePathExpectationB = Expect<Extends<RecursiveTupleExpectedNodePath, NodePath<RecursiveTupleNode>>>;
type RecursiveTupleArrayPathExpectationA = Expect<
  Extends<ArrayPath<RecursiveTupleNode>, RecursiveTupleExpectedArrayPath>
>;
type RecursiveTupleArrayPathExpectationB = Expect<
  Extends<RecursiveTupleExpectedArrayPath, ArrayPath<RecursiveTupleNode>>
>;

type RecursiveTupleArrayValueExpectation = Expect<Equal<PathValue<RecursiveTupleNode, "pair.1">, string[]>>;
type RecursiveTupleArrayItemValueExpectation = Expect<Equal<PathValue<RecursiveTupleNode, "pair.1.0">, string>>;

declare const recursivePathExpectationA: RecursivePathExpectationA;
declare const recursivePathExpectationB: RecursivePathExpectationB;
declare const recursiveFieldPathExpectationA: RecursiveFieldPathExpectationA;
declare const recursiveFieldPathExpectationB: RecursiveFieldPathExpectationB;
declare const recursiveNodePathExpectationA: RecursiveNodePathExpectationA;
declare const recursiveNodePathExpectationB: RecursiveNodePathExpectationB;
declare const recursiveArrayPathExpectationA: RecursiveArrayPathExpectationA;
declare const recursiveArrayPathExpectationB: RecursiveArrayPathExpectationB;
declare const recursiveValueExpectation: RecursiveValueExpectation;
declare const recursiveNextExpectation: RecursiveNextExpectation;
declare const recursiveChildrenExpectation: RecursiveChildrenExpectation;
declare const recursiveChildItemExpectation: RecursiveChildItemExpectation;
declare const recursiveTuplePathExpectationA: RecursiveTuplePathExpectationA;
declare const recursiveTuplePathExpectationB: RecursiveTuplePathExpectationB;
declare const recursiveTupleFieldPathExpectationA: RecursiveTupleFieldPathExpectationA;
declare const recursiveTupleFieldPathExpectationB: RecursiveTupleFieldPathExpectationB;
declare const recursiveTupleNodePathExpectationA: RecursiveTupleNodePathExpectationA;
declare const recursiveTupleNodePathExpectationB: RecursiveTupleNodePathExpectationB;
declare const recursiveTupleArrayPathExpectationA: RecursiveTupleArrayPathExpectationA;
declare const recursiveTupleArrayPathExpectationB: RecursiveTupleArrayPathExpectationB;
declare const recursiveTupleArrayValueExpectation: RecursiveTupleArrayValueExpectation;
declare const recursiveTupleArrayItemValueExpectation: RecursiveTupleArrayItemValueExpectation;

void recursivePathExpectationA;
void recursivePathExpectationB;
void recursiveFieldPathExpectationA;
void recursiveFieldPathExpectationB;
void recursiveNodePathExpectationA;
void recursiveNodePathExpectationB;
void recursiveArrayPathExpectationA;
void recursiveArrayPathExpectationB;
void recursiveValueExpectation;
void recursiveNextExpectation;
void recursiveChildrenExpectation;
void recursiveChildItemExpectation;
void recursiveTuplePathExpectationA;
void recursiveTuplePathExpectationB;
void recursiveTupleFieldPathExpectationA;
void recursiveTupleFieldPathExpectationB;
void recursiveTupleNodePathExpectationA;
void recursiveTupleNodePathExpectationB;
void recursiveTupleArrayPathExpectationA;
void recursiveTupleArrayPathExpectationB;
void recursiveTupleArrayValueExpectation;
void recursiveTupleArrayItemValueExpectation;

// @ts-expect-error recursion should stop before infinitely expanding nested next.value
const invalidRecursiveFieldPath: FieldPath<RecursiveNode> = "next.value";

// @ts-expect-error recursion should stop before infinitely expanding child value
const invalidRecursiveChildFieldPath: FieldPath<RecursiveNode> = "children.0.value";

// @ts-expect-error recursive tuple branch should stop at fixed self slot
const invalidRecursiveTupleFieldPath: FieldPath<RecursiveTupleNode> = "pair.0.pair.1.0";

void invalidRecursiveFieldPath;
void invalidRecursiveChildFieldPath;
void invalidRecursiveTupleFieldPath;
