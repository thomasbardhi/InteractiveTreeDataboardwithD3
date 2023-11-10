
  mapboxgl.accessToken =
    "pk.eyJ1IjoidGhvbWFzYmFyZCIsImEiOiJjbG9nMWN4bXAwc3cxMmpxY2RybWoyeHRyIn0.DXmcpJDmnCwnKGz4WTXXMw";

  // Initialize the map
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v10",
    center: [-71.15, 42.7],
    zoom: 12,
  });

  map.on("load", function () {
    map.boxZoom.disable();

    // Load data and plot points
    d3.csv("treedata.csv", d3.autoType).then(function (data) {
      data.forEach((d, i) => {
        d.id = i;
      });

      map.addSource("trees", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: data.map((d) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [d.Longitude, d.Latitude],
            },
            properties: {
              Species: d.SPECIES,
              DatePlanted: d.DATEPLANT,
              diameter: d.Diameter_a,
              id: d.id,
            },
          })),
        },
      });

      map.addLayer({
        id: "tree-circles",
        type: "circle",
        source: "trees",
        paint: {
          "circle-radius": 5,
          "circle-color": "green",
          "circle-opacity": 0.8,
        },
      });

      map.addLayer({
        id: "highlighted-tree-circles",
        type: "circle",
        source: "trees",
        paint: {
          "circle-radius": 5.5,
          "circle-color": "green",
          "circle-opacity": 0.8,
          "circle-stroke-color": "black",
          "circle-stroke-width": 2,
        },
        filter: ["in", "id", ""],
      });

      // Bounding Box Selection logic
      const canvas = map.getCanvasContainer();
      let start, current, box;

      canvas.addEventListener("mousedown", mouseDown, true);

      function updateCharts(selectedFeatures) {
        const chartData = selectedFeatures.map((feature) => ({
          species: feature.properties.Species,
          datePlanted: feature.properties.DatePlanted,
          diameter: feature.properties.diameter,
                }));
        console.log(chartData);
        // Call the update functions for the charts
        updateChartBar(chartData);
        updateChartPie(chartData);
      }

      function mousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return new mapboxgl.Point(
          e.clientX - rect.left - canvas.clientLeft,
          e.clientY - rect.top - canvas.clientTop
        );
      }

      function mouseDown(e) {
        if (!(e.shiftKey && e.button === 0)) return;

        map.dragPan.disable();
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("keydown", onKeyDown);
        start = mousePos(e);
      }

      function onMouseMove(e) {
        if (!box) {
          box = document.createElement("div");
          box.classList.add("boxdraw");
          canvas.appendChild(box);
        }
        current = mousePos(e);

        const minX = Math.min(start.x, current.x),
          maxX = Math.max(start.x, current.x),
          minY = Math.min(start.y, current.y),
          maxY = Math.max(start.y, current.y);

        const pos = `translate(${minX}px, ${minY}px)`;
        box.style.transform = pos;
        box.style.width = maxX - minX + "px";
        box.style.height = maxY - minY + "px";
      }

      function onMouseUp(e) {
        finish([start, mousePos(e)]);
      }

      function onKeyDown(e) {
        if (e.keyCode === 27) finish();
      }

      function finish(bbox) {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("mouseup", onMouseUp);

        if (box) {
          box.parentNode.removeChild(box);
          box = null;
        }

        if (bbox) {
          const features = map.queryRenderedFeatures(bbox, {
            layers: ["tree-circles"],
          });

          const selectedTreeIDs = features.map((f) => f.properties.id);
          map.setFilter(
            "highlighted-tree-circles",
            ["in", "id"].concat(selectedTreeIDs)
          );

          // Update charts with selected tree
          updateCharts(features);
        }

        map.dragPan.enable();
      }

      // Tooltip logic
      let tooltip;
      map.on("mouseenter", "tree-circles", function (e) {
        var features = map.queryRenderedFeatures(e.point, {
          layers: ["tree-circles"],
        });

        if (!features.length) {
          return;
        }

        var feature = features[0];
        tooltip = new mapboxgl.Popup({ offset: [0, 15] })
          .setLngLat(feature.geometry.coordinates)
          .setHTML(
            `<h3>Species: ${feature.properties.Species}</h3>` +
              `<p>Date Planted: ${feature.properties.DatePlanted}</p>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "tree-circles", function () {
        tooltip.remove();
      });

      // Add a Heat Map
      map.addLayer(
        {
          id: "tree-density-heatmap",
          type: "heatmap",
          source: "trees",
          maxzoom: 15,
          paint: {
            // Increase the heatmap weight based on frequency and property magnitude
            "heatmap-weight": {
              property: "Diameter_a",
              type: "exponential",
              stops: [
                [1, 0],
                [62, 1],
              ],
            },
            "heatmap-intensity": {
              stops: [
                [11, 1],
                [15, 3],
              ],
            },
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(33,102,172,0)",
              0.2,
              "rgb(103,169,207)",
              0.4,
              "rgb(209,229,240)",
              0.6,
              "rgb(253,219,199)",
              0.8,
              "rgb(239,138,98)",
              1,
              "rgb(178,24,43)",
            ],
            // Adjust the heatmap radius by zoom level
            "heatmap-radius": {
              stops: [
                [11, 15],
                [15, 20],
              ],
            },
            // Transition from heatmap to circle layer by zoom level
            "heatmap-opacity": {
              default: 1,
              stops: [
                [14, 1],
                [15, 0],
              ],
            },
          },
        },
        "waterway-label"
      );

      //Toggle Heatmap
      function toggleHeatmap(visibility) {
        map.setLayoutProperty("tree-density-heatmap", "visibility", visibility);
      }

      document
        .getElementById("heatmapToggle")
        .addEventListener("change", function (e) {
          toggleHeatmap(e.target.checked ? "visible" : "none");
        });

        // filter by year
        function filterByYear(year) {
            if(year === 'all') {
              map.setFilter('tree-circles', null);
            } else {
              map.setFilter('tree-circles', ['==', ['to-number', ['get', 'DatePlanted']], year]);
            }
          }
          
          document.getElementById('year-filter').addEventListener('change', function (e) {
            const year = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
            filterByYear(year);
          });

    });
    function toggleHeatmap(visibility) {
      map.setLayoutProperty("tree-density-heatmap", "visibility", visibility);
    }
  });



  function updateChartBar(selectedFeatures) {
    var diameters = selectedFeatures
      .map(function (feature) {
        return feature.diameter;
      })
      .filter(function (diameter) {
        return !isNaN(diameter) && diameter !== undefined;
      });

    var diameterCounts = {};
    diameters.forEach(function (diameter) {
      diameterCounts[diameter] = (diameterCounts[diameter] || 0) + 1;
    });

    var diameterEntries = Object.entries(diameterCounts).map(function (entry) {
      return {
        diameter: +entry[0],
        count: entry[1],
      };
    });

    diameterEntries.sort(function (a, b) {
      return d3.ascending(a.diameter, b.diameter);
    });

    d3.select("#bar").select("svg").remove();

    var margin = { top: 50, right: 30, bottom: 40, left: 50 },
      width = 500 - margin.left - margin.right,
      height = 400 - margin.top - margin.bottom;

    var svg = d3.select("#bar").select("svg");

    svg = d3
      .select("#bar")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3
      .scaleBand()
      .range([0, width])
      .domain(
        diameterEntries.map(function (d) {
          return d.diameter;
        })
      )
      .padding(0.1);

    var y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(diameterEntries, function (d) {
          return d.count;
        }),
      ])
      .range([height, 0]);

    var xAxis = svg.select(".x-axis");
    xAxis = svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")");
   
   
      xAxis.call(d3.axisBottom(x));


    var yAxis = svg.select(".y-axis");

    yAxis = svg.append("g").attr("class", "y-axis");

    yAxis.call(d3.axisLeft(y));

    // Define color scale
    const color = d3
      .scaleSequential((t) => {
        if (t <= 0.2)
          return d3.interpolateRgb(
            "rgba(33,102,172,0)",
            "rgb(103,169,207)"
          )(t / 0.2);
        if (t <= 0.4)
          return d3.interpolateRgb(
            "rgb(103,169,207)",
            "rgb(209,229,240)"
          )((t - 0.2) / 0.2);
        if (t <= 0.6)
          return d3.interpolateRgb(
            "rgb(209,229,240)",
            "rgb(253,219,199)"
          )((t - 0.4) / 0.2);
        if (t <= 0.8)
          return d3.interpolateRgb(
            "rgb(253,219,199)",
            "rgb(239,138,98)"
          )((t - 0.6) / 0.2);
        return d3.interpolateRgb(
          "rgb(239,138,98)",
          "rgb(178,24,43)"
        )((t - 0.8) / 0.2);
      })
      .domain([0, diameterEntries.length]);
    [0, diameterEntries.length];

    var bars = svg.selectAll(".bar").data(diameterEntries, function (d) {
      return d.diameter;
    });

    // Enter selection
    bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", function (d) {
        return x(d.diameter);
      })
      .attr("width", x.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", (d, i) => {
        const fillColor = color(i);
        return fillColor === "rgba(103, 169, 207, 0)" ? "#08306b" : fillColor;
      })
      .merge(bars) // Merge with the update selection
      .transition()
      .duration(800)
      .attr("y", function (d) {
        return y(d.count);
      })
      .attr("height", function (d) {
        return height - y(d.count);
      });

    // Exit selection
    bars
      .exit()
      .transition()
      .duration(800)
      .attr("y", height)
      .attr("height", 0)
      .remove();

    svg
      .selectAll(".bar")

      .on("mouseover", (event, d) => {
        // Add the black outline when hovering
        d3.select(event.currentTarget)
          .attr("stroke", "black")
          .attr("stroke-width", "2px");

        // Tooltip setup
        const tooltip = d3.select(".tooltip");
        tooltip
          .style("opacity", 1)
          .html(`Tree Count: ${d.count}`)
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", (event, d) => {
        // Remove the black outline when not hovering
        d3.select(event.currentTarget)
          .attr("stroke", null)
          .attr("stroke-width", null);

        // Hide the tooltip
        d3.select(".tooltip").style("opacity", 0);
      });
    // Add chart title
    svg
      .append("text")
      .attr("class", "bar-chart-title")
      .attr("x", width / 2)
      .attr("y", 0 - margin.top / 3)
      .attr("text-anchor", "middle")
      .style("font-size", "20px")
      .style("text-decoration", "underline")
      .text("Tree Diameter Distribution in Feet");
  }

  function updateChartPie(selectedFeatures) {
    selectedFeatures.forEach(function (d) {
      d.diameter = +d.diameter; // Ensure Diameter_a is a number
    });
    var diameterThreshold = 3.0;

    // Group data by size (MediumToLarge and Other)
    let groupedData = Array.from(
      d3.group(selectedFeatures, (d) =>
        d.diameter >= diameterThreshold ? "MediumToLarge" : "Other"
      ),
      ([key, value]) => ({ key, value })
    );

    console.log(groupedData);
    // Further group the medium-to-large trees by species and count them
    let mediumToLargeSpecies = groupedData.find(
      (d) => d.key === "MediumToLarge"
    )?.value;
    if (!mediumToLargeSpecies) {
      console.warn("No MediumToLarge trees found");
      mediumToLargeSpecies = [];
    }

    let otherSpecies = groupedData.find((d) => d.key === "Other")?.value;
    if (!otherSpecies) {
      console.warn("No Other trees found");
      otherSpecies = []; 
    }

    console.log(mediumToLargeSpecies);
    let mediumToLargeGrouped = Array.from(
      d3.group(mediumToLargeSpecies, (d) => d.species),
      ([key, value]) => ({ key, value: value.length })
    );

    console.log(mediumToLargeGrouped);

    let otherGrouped = Array.from(
      d3.group(otherSpecies, (d) => d.species),
      ([key, value]) => ({ key, value: value.length })
    );

    // Combine the grouped data for the nested pie chart
    let nestedData = [
      { key: "MediumToLarge", value: mediumToLargeGrouped },
      { key: "Other", value: otherGrouped },
    ];

    var width = 700,
      height = 400,
      radius = Math.min(width, height / 2) - 30;

    d3.select("#pie").select("svg").remove();

    var svg = d3
      .select("#pie")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr(
        "transform",
        "translate(" + width / 2 + "," + (height / 2 + 30) + ")"
      ); 

    var pie = d3
      .pie()
      .value(function (d) {
        return d3.sum(d.value, (v) => v.value);
      })
      .sort(null);

    var innerArc = d3
      .arc()
      .innerRadius(0)
      .outerRadius(radius / 3);

    var outerArc = d3
      .arc()
      .innerRadius(radius / 3)
      .outerRadius(radius - 10);

    var tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    function updateTooltip(htmlContent, event) {
      tooltip.transition().duration(200).style("opacity", 0.9);
      tooltip
        .html(htmlContent)
        .style("left", event.pageX + "px")
        .style("top", event.pageY - 28 + "px");
    }

    function hideTooltip() {
      tooltip.transition().duration(500).style("opacity", 0);
    }

    var mainColor = d3
      .scaleOrdinal()
      .domain(["MediumToLarge", "Other"])
      .range(["#d73027", "#4575b4"]);

    var otherColor = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, otherGrouped.length]);
    var mediumToLargeColor = d3
      .scaleSequential(d3.interpolateReds)
      .domain([0, mediumToLargeGrouped.length]);

    var innerPieData = pie(nestedData);
    var innerPie = svg
      .selectAll(".arc")
      .data(innerPieData)
      .enter()
      .append("g")
      .attr("class", "arc");

    innerPie
      .append("path")
      .attr("d", innerArc)
      .attr("fill", function (d) {
        return mainColor(d.data.key);
      })
      .transition() 
      .duration(800) 
      .attrTween("d", function (d) {
        var i = d3.interpolate(d.startAngle, d.endAngle);
        return function (t) {
          d.endAngle = i(t);
          return innerArc(d);
        };
      });

    svg
      .selectAll(".arc")
      .on("mouseover", function (event, d) {
        var treeSize =
          d.data.key === "MediumToLarge" ? "Medium to Large" : "Small";
        var count = d3.sum(d.data.value, (v) => v.value); 
        var htmlContent =
          "<strong>" +
          treeSize +
          " </strong> <br/>" +
          "<strong>Tree Count:</strong> " +
          count;
        updateTooltip(htmlContent, event);
        d3.select(this).style("stroke", "black").style("stroke-width", "2px"); // Add black outline
      })
      .on("mouseout", function () {
        hideTooltip(); // Hide the tooltip
        d3.select(this).style("stroke", null).style("stroke-width", null); // Remove outline
      });

    // Function to create nested pie chart
    function createNestedPie(outerData, innerDataKey, startAngle, endAngle) {
      var nestedPie = d3
        .pie()
        .value(function (d) {
          return d.value;
        })
        .startAngle(startAngle)
        .endAngle(endAngle)
        .sort(null);

      var nestedPieData = nestedPie(
        outerData.find((d) => d.key === innerDataKey).value
      );
      var colorScale =
        innerDataKey === "MediumToLarge" ? mediumToLargeColor : otherColor;

      svg
        .selectAll(".nestedArc" + innerDataKey)
        .data(nestedPieData)
        .enter()
        .append("path")
        .attr("d", outerArc)
        .attr("fill", function (d, i) {
          return colorScale(i);
        })
        .on("mouseover", function (event, d) {
          if (d && d.data) {
            var htmlContent =
              "<strong>Species:</strong> " +
              d.data.key +
              "<br/>" +
              "<strong>Count:</strong> " +
              d.data.value +
              "<br/>" +
              "<strong>Size:</strong> " +
              (innerDataKey === "MediumToLarge" ? "Medium to Large" : "Small");
            updateTooltip(htmlContent, event);
          }
          d3.select(this).style("stroke", "black").style("stroke-width", "2px");
        })
        .on("mouseout", function () {
          hideTooltip();
          d3.select(this).style("stroke", null).style("stroke-width", null);
        })
        .transition() // Start a transition when new elements are added
        .duration(800) // Duration of the transition in milliseconds
        .attrTween("d", function (d) {
          var i = d3.interpolate(
            { startAngle: startAngle, endAngle: startAngle },
            d
          );
          return function (t) {
            return outerArc(i(t));
          };
        });
    }


    // Create the nested pie charts
    innerPieData.forEach(function (d) {
      createNestedPie(nestedData, d.data.key, d.startAngle, d.endAngle);
    });

    svg
      .append("text")
      .attr("class", "pie-chart-title") 
      .attr("x", 0) 
      .attr("y", 0 - height / 2) 
      .attr("text-anchor", "middle") 
      .style("font-size", "20px") 
      .style("text-decoration", "underline") 
      .text(
        "Medium To Large Trees vs Smaller Trees by Tree Species Distribution"
      ); 
  }

  
