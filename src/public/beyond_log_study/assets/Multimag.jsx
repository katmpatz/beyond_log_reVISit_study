import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const getExponent = (value, base) => {
  if(value == 0) return 0;
  // To calculate the base-1000 logarithm using Math.log(value), 
  // you would need to adjust the formula to convert from the natural logarithm to the base-1000 logarithm.
  const baseLog = Math.log(value) / Math.log(base);
  return Math.trunc(baseLog);
}

const getMantissa = (value, base) => {
  if(value == 0) return 0;
  // To calculate the base-1000 logarithm using Math.log(value), 
  // you would need to adjust the formula to convert from the natural logarithm to the base-1000 logarithm.
  const baseLog = Math.log(value) / Math.log(base);
  return value / (base ** Math.floor(baseLog));
}

const getExponentPlusMantissa = (value, base) => {
    const exp = getExponent(value, base);
    const mant = getMantissa(value, base);
    return exp + (mant - 1)/(base - 1);
}

const facetRow = (number) => {
    if(number < 1000){
      return 0;
    } else if(number >= 1000 && number <1000000){
      return 3;
    } else if (number >= 1000000 && number <1000000000){
      return 2;
    } else if (number >= 1000000000 && number <1000000000000){
      return 1;
    } else {
      return 0;
    } 
  }

 const getMagnitudeCategory = (number) => {
    let unit;
    if(number < 1000){
      unit = 1
    } else if(number >= 1000 && number <1000000){
      unit = 3
    } else if (number >= 1000000 && number <1000000000){
      unit = 6
    } else if (number >= 1000000000 && number <1000000000000){
      unit = 9
    } else if (number >= 1000000000000 && number <10000000000000000){
      unit = 12
    } else {
      unit = 15; // just a very big category, adjust if you have values larger than 999 Trillions
    }
    return unit;
  }

  const getCategoryText = (category) => {
    if(category == 3){
        return "THOUSANDS"
      } else if (category == 6){
        return "MILLIONS"
      } else if (category == 9){
        return "BILLIONS"
      } else if (category == 12){
        return "TRILLIONS"
      } else {
        return "";
      }
  }

const categoricalMagnitudeScale = (d, category) => {
    const base = 10;
    const exp = Math.trunc(d);
    if(d - exp == 0){
      if(exp > 2){ // change magnitude category
        return base**(exp-3) + getCategory(category + 3);
      }
      return base**exp + getCategory(category);
    } else {
      const mant = (base - 1) * (d - exp) + 1;
      const value = Math.round(mant*base**(exp) * 100) / 100;  // correcting for rounding errors
      return value + getCategory(category);
    }
  }

const getCategory = (category) => {
    if(category == 3){
        return "k"
      } else if (category == 6){
        return "M"
      } else if (category == 9){
        return "B"
      } else if (category == 12){
        return "T"
      } else {
        return "T";
      }
  }

const MultiMagChart = ({ parameters, answers }) => {
  const chartContainer = useRef(null);

  // ---- derive current trial (same pattern as EplusM / LogChart) ----
  const current = useMemo(() => {
    const ds = parameters?.dataset?.dataSetup;
    const idx = parameters?.currentTrial ?? -1;

    if (!Array.isArray(ds) || idx < 0 || idx >= ds.length) return null;
    return ds[idx];
  }, [parameters?.dataset?.dataSetup, parameters?.currentTrial]);

  // ---- local state sourced from current ----
  const [data, setData] = useState(() => current?.data ?? []);
  const [selectedCategory1, setSelectedCategory1] = useState(
    () => current?.selectedCategory1 ?? ""
  );
  const [selectedCategory2, setSelectedCategory2] = useState(
    () => current?.selectedCategory2 ?? ""
  );

  useEffect(() => {
    if (!current) return;
    setData(Array.isArray(current.data) ? current.data : []);
    setSelectedCategory1(current.selectedCategory1 ?? "");
    setSelectedCategory2(current.selectedCategory2 ?? "");
  }, [current]);

  // ---- layout + constants (aligned with others) ----
  const width = 800;
  const height = 600;
  const marginLeft = 50;
  const marginRight = 100;
  const marginTop = 40;
  const marginBottom = 60;

  const selectedColor = "#F85741";
  const oddBackgroundColor = "#f0f0f0";
  const barColor = "#14164C";

  // horizontal lines for mantissa = 5 in each exponent band: (m-1)/9 = 4/9
  const horizontalLinesBase = [];
  const lightTicksBase = [];
  for (let i = 0; i < 3; i++) {
    const v = i + 0.4444444444444;
    horizontalLinesBase.push(v);
    lightTicksBase.push(v);
  }

  // ---- draw/update ----
  useEffect(() => {
    if (!Array.isArray(data) || data.length === 0) return;
    if (!chartContainer.current) return;
    updateChart(data, selectedCategory1, selectedCategory2);
  }, [data, selectedCategory1, selectedCategory2]);

  function updateChart(chartData, sel1, sel2) {
    // safety: numeric conversion
    const numericValues = chartData.map((d) =>
      +String(d.Value).replace(/,/g, "")
    );
    const maxVal = d3.max(numericValues);
    if (!Number.isFinite(maxVal) || maxVal <= 0) {
      const svgSmoke = d3
        .select(chartContainer.current)
        .attr("width", width)
        .attr("height", height);
      svgSmoke.selectAll("*").remove();
      svgSmoke
        .append("rect")
        .attr("x", 10)
        .attr("y", 10)
        .attr("width", 80)
        .attr("height", 40)
        .attr("fill", "red");
      return;
    }

    // group data by magnitude category (e.g., 10^3, 10^6, etc.)
    const dataByCategory = d3.group(chartData, (d) =>
      getMagnitudeCategory(d.Value)
    );

    const sortedDataByCategory = Array.from(dataByCategory.entries()).sort(
      (a, b) => d3.ascending(+a[0], +b[0])
    );
    const sortedMap = new Map(sortedDataByCategory);

    const categoriesCount = dataByCategory.size;
    const categoriesPadding = 4;
    const categoriesHeight =
      (height - marginTop - marginBottom - (categoriesCount - 1) * categoriesPadding) /
      categoriesCount;
    const facetHeight = categoriesHeight / 3; // three exponents per category

    const categoriesToHighlight = [sel1, sel2].filter(Boolean);

    // custom ticks within each facet
    const allTicks = [];
    for (let exp = 0; exp < 3; exp++) {
      for (let m = 1; m < 10; m++) {
        allTicks.push(exp + (m - 1) / (10 - 1));
      }
    }

    // x scale over *all* categories
    const x = d3
      .scaleBand()
      .domain(
        chartData
          .map((d) => d.Category)
          .slice()
          .sort()
      )
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    const svg = d3
      .select(chartContainer.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", null);

    svg.selectAll("*").remove();

    // x-axis
    const xAxis = svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0));

    xAxis
      .selectAll(".tick text")
      .style("font-size", "1.2rem")
      .style("fill", (d) =>
        categoriesToHighlight.includes(d) ? selectedColor : "#000"
      )
      .style("font-weight", (d) =>
        categoriesToHighlight.includes(d) ? "bold" : "normal"
      );

    // facets by magnitude category (reverse so largest at top)
    Array.from(sortedMap.entries())
      .reverse()
      .forEach(([category, group], index) => {
        const g = svg
          .append("g")
          .attr(
            "transform",
            `translate(0,${marginTop + index * (categoriesHeight + categoriesPadding)})`
          );

        // local y scale (0–3 exponents in this magnitude category)
        const y = d3
          .scaleLinear()
          .domain([0, 3])
          .range([categoriesHeight, 0]);

        // facet background
        g.append("rect")
          .attr("x", marginLeft)
          .attr("y", 0)
          .attr("width", width - marginLeft - marginRight)
          .attr("height", categoriesHeight)
          .attr("fill", "#fff");

        // facet label (rotated on the right)
        g.append("text")
          .attr(
            "transform",
            `translate(${width - marginRight + 65}, ${categoriesHeight / 2}) rotate(90)`
          )
          .attr("text-anchor", "middle")
          .attr("font-family", "Inter, sans-serif")
          .attr("font-size", "1.5rem")
          .attr("font-weight", "bold")
          .attr("fill", barColor)
          .text(getCategoryText(category));

        // vertical line next to label
        g.append("line")
          .attr("x1", width - 45)
          .attr("x2", width - 45)
          .attr("y1", 10)
          .attr("y2", categoriesHeight - 10)
          .attr("stroke", barColor)
          .attr("stroke-width", 2);

        // mid exponent background band
        g.append("rect")
          .attr("x", marginLeft)
          .attr("y", categoriesHeight - facetHeight * 2)
          .attr("width", width - marginLeft - marginRight)
          .attr("height", facetHeight)
          .attr("fill", oddBackgroundColor);

        // border
        g.append("rect")
          .attr("x", marginLeft)
          .attr("y", 0)
          .attr("width", width - marginLeft - marginRight)
          .attr("height", categoriesHeight)
          .attr("fill", "none")
          .attr("stroke", "black")
          .attr("stroke-width", 1);

        // thick grid (0,1,2)
        g.append("g")
          .attr("transform", `translate(${marginLeft},0)`)
          .call(
            d3
              .axisLeft(y)
              .tickValues([0, 1, 2])
              .tickSize(-width + marginLeft + marginRight)
              .tickFormat("")
          )
          .call((gg) => {
            gg.select(".domain").remove();
            gg.selectAll(".tick line")
              .attr("stroke", "#18182B")
              .attr("stroke-width", 1);
          });

        // thin grid (mantissa ~5)
        g.append("g")
          .attr("transform", `translate(${marginLeft},0)`)
          .call(
            d3
              .axisLeft(y)
              .tickValues(horizontalLinesBase)
              .tickSize(-width + marginLeft + marginRight)
              .tickFormat("")
          )
          .call((gg) => {
            gg.select(".domain").remove();
            gg.selectAll(".tick line")
              .attr("stroke", "#18182B")
              .attr("stroke-opacity", 0.5)
              .attr("stroke-width", 0.5);
          });

        // strong ticks left (0,1,2)
        g.append("g")
          .attr("transform", `translate(${marginLeft},0)`)
          .call(
            d3
              .axisLeft(y)
              .tickValues([0, 1, 2])
              .tickFormat((d) => categoricalMagnitudeScale(d, category))
              .tickSize(4)
          )
          .call((gg) => {
            gg.selectAll(".tick text")
              .style("font-size", "1rem")
              .style("font-weight", "bold")
              .style("fill", "#000");
          });

        // topmost facet also shows the next magnitude label (3) on top
        if (index === 0) {
          g.append("g")
            .attr("transform", `translate(${marginLeft},0)`)
            .call(
              d3
                .axisLeft(y)
                .tickValues([3])
                .tickFormat((d) => categoricalMagnitudeScale(d, category))
                .tickSize(4)
            )
            .call((gg) => {
              gg.selectAll(".tick text")
                .style("font-size", "1rem")
                .style("font-weight", "bold")
                .style("fill", "#000");
            });

          g.append("g")
            .attr("transform", `translate(${width - marginRight},0)`)
            .call(
              d3
                .axisRight(y)
                .tickValues([3])
                .tickFormat((d) => categoricalMagnitudeScale(d, category))
                .tickSize(4)
            )
            .call((gg) => {
              gg.selectAll(".tick text")
                .style("font-size", "1rem")
                .style("font-weight", "bold")
                .style("fill", "#000");
            });
        }

        // light ticks left (mantissa ~5)
        g.append("g")
          .attr("transform", `translate(${marginLeft},0)`)
          .call(
            d3
              .axisLeft(y)
              .tickValues(lightTicksBase)
              .tickFormat((d) => categoricalMagnitudeScale(d, category))
              .tickSize(4)
          )
          .call((gg) => {
            gg.select(".domain").remove();
            gg.selectAll(".tick text")
              .style("font-size", "1rem")
              .style("fill", "#8E8F96");
          });

        // strong ticks right
        g.append("g")
          .attr("transform", `translate(${width - marginRight},0)`)
          .call(
            d3
              .axisRight(y)
              .tickValues([0, 1, 2])
              .tickFormat((d) => categoricalMagnitudeScale(d, category))
              .tickSize(4)
          )
          .call((gg) => {
            gg.selectAll(".tick text")
              .style("font-size", "1rem")
              .style("font-weight", "bold")
              .style("fill", "#000");
          });

        // light ticks right
        g.append("g")
          .attr("transform", `translate(${width - marginRight},0)`)
          .call(
            d3
              .axisRight(y)
              .tickValues(lightTicksBase)
              .tickFormat((d) => categoricalMagnitudeScale(d, category))
              .tickSize(4)
          )
          .call((gg) => {
            gg.select(".domain").remove();
            gg.selectAll(".tick text")
              .style("font-size", "1rem")
              .style("fill", "#8E8F96");
          });

        // bars in this facet
        g.append("g")
          .selectAll("rect")
          .data(group)
          .enter()
          .append("rect")
          .attr("x", (d) => x(d.Category))
          .attr("y", (d) =>
            y(getExponentPlusMantissa(d.Value, 10) - +category)
          )
          .attr("height", (d) => {
            const val = getExponentPlusMantissa(d.Value, 10) - +category;
            return y(0) + 4 - y(val); // +4 to avoid invisible bars
          })
          .attr("width", x.bandwidth())
          .attr("fill", barColor);

        // dense tick marks left
        g.append("g")
          .attr("transform", `translate(${marginLeft},0)`)
          .call(
            d3.axisLeft(y).tickValues(allTicks).tickFormat("").tickSize(4)
          )
          .call((gg) => gg.select(".domain").remove());

        // dense tick marks right
        g.append("g")
          .attr("transform", `translate(${width - marginRight},0)`)
          .call(
            d3.axisRight(y).tickValues(allTicks).tickFormat("").tickSize(4)
          )
          .call((gg) => gg.select(".domain").remove());
      });

    // dashed vertical lines from x-axis up into facets
    svg
      .append("g")
      .selectAll("line")
      .data(chartData)
      .enter()
      .append("line")
      .attr("x1", (d) => x(d.Category) + x.bandwidth() / 2)
      .attr("y1", height - marginBottom)
      .attr(
        "x2",
        (d) => x(d.Category) + x.bandwidth() / 2
      )
      .attr(
        "y2",
        (d) =>
          facetRow(d.Value) * (categoriesHeight + 2 + categoriesPadding) +
          marginTop -
          categoriesPadding
      )
      .attr("stroke", "#18182B")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1);

    // arrow marker (if you want to use it later)
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 5)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", selectedColor);

    // y-axis label
    svg
      .append("text")
      .attr("x", marginLeft)
      .attr("y", marginTop - 15)
      .attr("text-anchor", "end")
      .text("Value")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // unit legend
    svg
      .append("text")
      .attr("x", marginLeft)
      .attr("y", height - 5)
      .attr("text-anchor", "start")
      .text(
        "k = Thousand (1,000),  M = Million (1,000,000),  B = Billion (1,000,000,000)"
      )
      .attr("alignment-baseline", "start")
      .attr("font-size", "1.2rem")
      .attr("fill", "#000");

    // highlight boxes for selected categories
    categoriesToHighlight.forEach((cat) => {
      const xPos = x(cat);
      if (xPos == null) return;
      const xSpace = 10;
      const yTop = marginTop - 10;
      const yBottom = height - 25;

      svg
        .append("rect")
        .attr("fill", "transparent")
        .attr("stroke", selectedColor)
        .attr("stroke-width", 3)
        .attr("x", xPos - xSpace)
        .attr("y", yTop)
        .attr("height", yBottom - yTop)
        .attr("width", x.bandwidth() + xSpace * 2);
    });
  }

  return <svg ref={chartContainer} width={800} height={500} />;
};

export default MultiMagChart;
