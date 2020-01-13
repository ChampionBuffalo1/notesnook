import React from "react";
import * as Icon from "react-feather";
import { Flex, Box, Text } from "rebass";
import { Input } from "@rebass/forms";
import CheckBox from "../checkbox";
import { PinIcon } from "../icons";

const Properties = props => {
  return (
    <Flex
      sx={{ borderLeft: "1px solid", borderColor: "border", width: "25%" }}
      flexDirection="column"
      bg="shade"
      px={3}
      py={3}
    >
      <Text variant="title" color="primary" my={2}>
        Properties
      </Text>
      <CheckBox
        checked={props.pinned}
        icon={PinIcon}
        label="Pin"
        onChecked={props.onPinned}
      />
      <CheckBox
        icon={Icon.Star}
        checked={props.favorite}
        label="Favorite"
        onChecked={props.onFavorited}
      />
      <CheckBox icon={Icon.Lock} label="Lock" onChecked={props.onLocked} />
      <Flex fontSize="body" sx={{ marginBottom: 2 }} alignItems="center">
        <Icon.Tag size={18} />
        <Text sx={{ marginLeft: 1 }}>Tags:</Text>
      </Flex>
      <Input
        variant="default"
        placeholder="#tag"
        sx={{ marginBottom: 2 }}
        onKeyUp={e => {
          if (e.key === "Enter" || e.key === " " || e.key === ",") {
            props.addTag && props.addTag(e.target.value);
            e.target.value = "";
          }
        }}
      />
      <Flex
        fontSize="body"
        sx={{ marginBottom: 2 }}
        alignItems="center"
        justifyContent="flex-start"
        flexWrap="wrap"
      >
        {props.tags &&
          props.tags.map(v => (
            <Text
              sx={{
                backgroundColor: "primary",
                color: "static",
                borderRadius: "default",
                padding: "2px 5px 2px 5px",
                marginBottom: 1,
                marginRight: 1
              }}
            >
              #{v}
            </Text>
          ))}
      </Flex>
      <Flex fontSize="body" sx={{ marginBottom: 2 }} alignItems="center">
        <Icon.Octagon size={18} />
        <Text sx={{ marginLeft: 1 }}>Colors:</Text>
      </Flex>
      <Flex flexWrap="wrap" sx={{ marginBottom: 2 }}>
        {[
          { label: "red", code: "#ed2d37" },
          { label: "orange", code: "#ec6e05" },
          { label: "yellow", code: "yellow" },
          { label: "green", code: "green" },
          { label: "blue", code: "blue" },
          { label: "purple", code: "purple" },
          { label: "gray", code: "gray" }
        ].map(color => (
          <Flex
            sx={{ position: "relative" }}
            justifyContent="center"
            alignItems="center"
            onClick={() => props.colorSelected && props.colorSelected(color)}
          >
            <Icon.Circle
              size={40}
              style={{ cursor: "pointer" }}
              fill={color.code}
              strokeWidth={0}
            />
            {props.selectedColors &&
              props.selectedColors.includes(color.label) && (
                <Icon.Check
                  style={{
                    position: "absolute",
                    color: "white"
                  }}
                  size={20}
                />
              )}
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};

export default Properties;
