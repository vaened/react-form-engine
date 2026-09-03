/**
 * @author enea dhack <contact@vaened.dev>
 * @link https://vaened.dev DevFolio
 */

import type { Equal, Expect } from "../../path/__tests__/type-assertions";
import type { EntryId } from "../path/types";
import { StateGraph } from "../state/StateGraph";
import type { StateFieldEntry, StateNodeEntry } from "../state/types";
import { ValueGraph } from "./../value/ValueGraph";
import type { ObservationChain } from "./ObservationChain";

const id = (value: number) => value as EntryId;

/**
 * The root keeps its own type instead of coming back as the wide union, which is
 * what let `StateGraph` drop the copy of it that it used to hold on the side.
 */
const state = new StateGraph(id(0));

type StateRootExpectation = Expect<Equal<ReturnType<typeof state.root>, StateNodeEntry>>;

const values = new ValueGraph(id(0));

type ValueRootExpectation = Expect<Equal<ReturnType<typeof values.root>, ReturnType<typeof values.entry>>>;

/**
 * Only a node can sit above anybody. Handing a field over as a parent has to be
 * refused by the compiler rather than caught at runtime, which is exactly what
 * the single `TNode` parameter could not express: `StateEntry` was widened to
 * accept a field there and only property covariance let it through.
 */
declare const chain: ObservationChain<StateFieldEntry | StateNodeEntry, StateNodeEntry>;
declare const field: StateFieldEntry;
declare const node: StateNodeEntry;

// @ts-expect-error a field cannot be a parent
chain.join(node, field);

// @ts-expect-error a field cannot be a parent
chain.insert(node, field, []);

// @ts-expect-error a field cannot take children on
chain.insert(field, node, []);

type RemovedParentExpectation = Expect<Equal<ReturnType<typeof chain.remove>["parent"], StateNodeEntry>>;

export type { RemovedParentExpectation, StateRootExpectation, ValueRootExpectation };
