import {
  P1EventSchema,
  type FloorplanEditOperation,
  type GeometryHash,
  type P1Event,
  type P1EventType
} from "@homeai/contracts";
import type { P1EventRepository } from "./repositories.js";

export type P1EventActor = {
  userId?: string;
  anonymousSessionId?: string;
};

export type EmitP1EventInput = P1EventActor & {
  eventId: string;
  eventType: P1EventType;
  homeId: string;
  draftRevisionId: string;
  canonicalRevisionId?: string;
  geometryHash?: GeometryHash;
  previousGeometryHash?: GeometryHash;
  newGeometryHash?: GeometryHash;
  operationType?: FloorplanEditOperation["operationType"];
  timestamp: string;
};

export function emitP1Event(repository: P1EventRepository, input: EmitP1EventInput): P1Event {
  const event = P1EventSchema.parse({
    eventId: input.eventId,
    eventType: input.eventType,
    homeId: input.homeId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    ...(input.anonymousSessionId === undefined ? {} : { anonymousSessionId: input.anonymousSessionId }),
    draftRevisionId: input.draftRevisionId,
    ...(input.canonicalRevisionId === undefined ? {} : { canonicalRevisionId: input.canonicalRevisionId }),
    ...(input.geometryHash === undefined ? {} : { geometryHash: input.geometryHash }),
    ...(input.previousGeometryHash === undefined ? {} : { previousGeometryHash: input.previousGeometryHash }),
    ...(input.newGeometryHash === undefined ? {} : { newGeometryHash: input.newGeometryHash }),
    ...(input.operationType === undefined ? {} : { operationType: input.operationType }),
    timestamp: input.timestamp,
    source: "p1_editor"
  });
  return repository.appendEvent(event);
}

export function eventTypeForOperation(operationType: FloorplanEditOperation["operationType"]): P1EventType | undefined {
  switch (operationType) {
    case "wall.add":
      return "p1_wall_added";
    case "wall.delete":
      return "p1_wall_deleted";
    case "wall.resize":
      return "p1_wall_resized";
    case "wall.moveEndpoint":
      return "p1_wall_resized";
    case "door.add":
      return "p1_door_added";
    case "door.delete":
      return "p1_door_deleted";
    case "door.direction.change":
      return "p1_door_direction_changed";
    case "window.add":
      return "p1_window_added";
    case "window.delete":
      return "p1_window_deleted";
    case "window.type.change":
      return "p1_window_type_changed";
    case "balcony.add":
      return "p1_balcony_added";
    case "balcony.delete":
      return "p1_balcony_deleted";
    case "balcony.type.change":
      return "p1_balcony_type_changed";
    case "room.type.change":
      return "p1_room_type_changed";
    case "wall.thickness.change":
      return "p1_wall_thickness_changed";
    case "freeWall.draw":
      return "p1_free_wall_drawn";
    case "floorHeight.change":
      return "p1_floor_height_changed";
    case "door.dimension.change":
      return "p1_door_dimension_changed";
    case "create_wall":
    case "modify_wall":
    case "delete_wall":
    case "create_opening":
    case "modify_opening":
    case "delete_opening":
    case "create_room":
    case "modify_room":
    case "delete_room":
    case "update_global_params":
    case "validate_draft":
      return undefined;
  }
}
