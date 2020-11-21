import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flex } from "rebass";
import Button from "../button";
import * as Icon from "../icons";
import { VariableSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useStore as useSelectionStore } from "../../stores/selection-store";
import GroupHeader from "../group-header";
import ListProfiles from "../../common/list-profiles";

function ListContainer(props) {
  const { type, context } = props;
  const profile = useMemo(() => ListProfiles[type], [type]);
  const shouldSelectAll = useSelectionStore((store) => store.shouldSelectAll);
  const setSelectedItems = useSelectionStore((store) => store.setSelectedItems);
  const [expandedGroup, setExpandedGroup] = useState(-1);
  const listRef = useRef();

  useEffect(() => {
    if (shouldSelectAll) setSelectedItems(props.items);
  }, [shouldSelectAll, setSelectedItems, props.items]);

  useEffect(() => {
    if (props.static) return;
    // whenever there is a change in items array we have to reset the size cache
    // so it can be recalculated.
    if (listRef.current) {
      listRef.current.resetAfterIndex(0, true);
    }
  }, [props.items, listRef, props.static]);

  return (
    <Flex variant="columnFill">
      {!props.items.length && props.placeholder ? (
        <Flex variant="columnCenterFill">
          <props.placeholder />
        </Flex>
      ) : (
        <>
          <Flex variant="columnFill" data-test-id="note-list">
            {props.children
              ? props.children
              : props.items.length > 0 && (
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        ref={listRef}
                        height={height}
                        width={width}
                        itemKey={(index) => {
                          switch (index) {
                            default:
                              const item = props.items[index];
                              return item.id || item.title;
                          }
                        }}
                        overscanCount={3}
                        estimatedItemSize={profile.estimatedItemHeight}
                        itemSize={(index) => {
                          const item = props.items[index];
                          if (item.type === "header") {
                            if (!item.title) return 0;
                            return index === expandedGroup ? 208 : 29;
                          } else {
                            return profile.itemHeight(item);
                          }
                        }}
                        itemCount={props.items.length}
                      >
                        {({ index, style }) => {
                          const item = props.items[index];
                          return (
                            <div key={item.id} style={style}>
                              {item.type === "header" ? (
                                <GroupHeader
                                  title={item.title}
                                  isExpanded={expandedGroup === index}
                                  onExpand={() => {
                                    setExpandedGroup((s) =>
                                      s === -1 ? index : -1
                                    );
                                    listRef.current.resetAfterIndex(
                                      index,
                                      true
                                    );
                                  }}
                                />
                              ) : (
                                profile.item(index, item, context)
                              )}
                            </div>
                          );
                        }}
                      </List>
                    )}
                  </AutoSizer>
                )}
          </Flex>
        </>
      )}
      {props.button && (
        <Button
          testId={`${props.type}-action-button`}
          Icon={props.button.icon || Icon.Plus}
          content={props.button.content}
          onClick={props.button.onClick}
          show={props.button.show}
        />
      )}
    </Flex>
  );
}
export default ListContainer;
