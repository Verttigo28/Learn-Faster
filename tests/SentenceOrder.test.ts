// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SentenceOrder from "../src/components/SentenceOrder.vue";

describe("SentenceOrder", () => {
  it("keeps the remaining words in a stable order while picking", async () => {
    const tokens = ["Saya", "mau", "minum", "kopi", "panas", "sekarang"];
    const wrapper = mount(SentenceOrder, {
      props: {
        tokens,
        modelValue: [],
        "onUpdate:modelValue": (v: string[]) => wrapper.setProps({ modelValue: v })
      }
    });
    const remaining = () => wrapper.findAll("button").slice(wrapper.props("modelValue")!.length).map((b) => b.text());

    const before = remaining();
    expect([...before].sort()).toEqual([...tokens].sort());

    await wrapper.findAll("button")[0].trigger("click"); // pick first remaining word
    const after = remaining();
    expect(after).toEqual(before.slice(1));
    expect(wrapper.props("modelValue")).toEqual([before[0]]);
  });
});
